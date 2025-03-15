import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import * as z from 'zod';
import { grantVIPStatus, removeVIPStatus, isUserVIP, getAllChannelVIPs, TwitchVIP } from '@/lib/twitch';
import { createVIPSession, deactivateVIPSession, getActiveVIPSessions, logAuditEvent, getUser, updateVIPSessionExpiration } from '@/lib/db';
import { broadcastToChannel } from '@/lib/sse';
import { authOptions } from '@/lib/auth';
import type { VIPSession } from '@/types/database';
import { appClient } from '@/lib/twitch-server';

const grantVIPSchema = z.object({
  userId: z.string(),
  username: z.string(),
  channelId: z.string(),
  redeemedWith: z.enum(['channel_points', 'manual']),
});

// Combined VIP data with source information
export interface EnhancedVIP {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl: string;
  isChannelPointsVIP: boolean;
  expiresAt?: string;
  grantMethod?: string;
  sessionId?: string;
}

// Schema for validating the request body
const vipSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
  username: z.string(),
  grantedBy: z.string(),
  grantMethod: z.enum(['manual', 'channelPoints', 'subscription', 'bits', 'other']).default('manual'),
  metadata: z.record(z.any()).optional(),
});

const extendSchema = z.object({
  sessionId: z.string(),
  hours: z.number().default(12),
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const result = vipSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request body', details: result.error }, { status: 400 });
    }
    
    const { channelId, userId, username, grantedBy, grantMethod, metadata } = result.data;

    // Get user to verify ownership
    const user = await getUser(session.user.id);
    if (!user || (user.twitchId !== channelId && user.twitchId !== grantedBy)) {
      return NextResponse.json({ error: 'Unauthorized to grant VIP status for this channel' }, { status: 403 });
    }

    // Get VIP duration from user settings
    const vipDuration = user.settings.vipDuration || 12 * 60 * 60 * 1000; // Default to 12 hours
    
    // Calculate expiration date
    const now = new Date();
    const expiresAt = new Date(now.getTime() + vipDuration);

    try {
      // Grant VIP status via Twitch API
      await appClient.channels.addVip(channelId, userId);
      
      // Create VIP session in database
      const vipSession = await createVIPSession({
        channelId,
        userId,
        username,
        isActive: true,
        grantedAt: now,
        expiresAt,
        grantedBy,
        grantMethod,
        metadata,
      });
      
      // Log audit event
      await logAuditEvent({
        channelId,
        action: 'grant_vip',
        performedBy: grantedBy,
        performedByUsername: user.username,
        targetUserId: userId,
        targetUsername: username,
        details: {
          grantMethod,
          expiresAt,
          metadata,
        },
      });
      
      return NextResponse.json({ 
        success: true, 
        session: vipSession,
        message: `VIP status granted to ${username} until ${expiresAt.toISOString()}`
      });
    } catch (error: any) {
      console.error('Error granting VIP status:', error);
      
      // Check if the error is because the user is already a VIP
      if (error.message?.includes('already a VIP')) {
        return NextResponse.json({ 
          success: false, 
          error: `${username} is already a VIP in this channel`
        }, { status: 400 });
      }
      
      return NextResponse.json({ 
        success: false, 
        error: `Failed to grant VIP status: ${error.message || 'Unknown error'}`
      }, { status: 500 });
    }
  } catch (error) {
    console.error('Error in VIP API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const channelId = searchParams.get('channelId');
    const userId = searchParams.get('userId');

    if (!sessionId || !channelId || !userId) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      );
    }

    // Remove VIP status
    const success = await removeVIPStatus(channelId, userId);
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to remove VIP status' },
        { status: 500 }
      );
    }

    // Deactivate VIP session
    await deactivateVIPSession(sessionId);

    // Log audit event
    await logAuditEvent({
      channelId,
      action: 'remove_vip',
      targetUserId: userId,
      performedBy: session.user?.name || 'system',
      details: {
        sessionId,
        manualRemoval: true,
      },
    });

    // Get updated VIP list and broadcast
    const activeSessions = await getActiveVIPSessions(channelId);
    broadcastToChannel(channelId, {
      type: 'vip_update',
      vips: activeSessions,
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in VIP DELETE:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');
    const includeAllVips = searchParams.get('includeAllVips') === 'true';

    if (!channelId) {
      return NextResponse.json(
        { error: 'Missing channelId parameter' },
        { status: 400 }
      );
    }

    // Get active VIP sessions from our database (channel points VIPs)
    const activeSessions = await getActiveVIPSessions(channelId);
    
    // If we only want tracked VIPs, return just those
    if (!includeAllVips) {
      return NextResponse.json(activeSessions);
    }
    
    // Otherwise, get all VIPs from Twitch API
    const allTwitchVIPs = await getAllChannelVIPs(session.accessToken as string, channelId);
    
    // Create a map of channel points VIPs for quick lookup
    const channelPointsVIPMap = new Map<string, VIPSession>();
    activeSessions.forEach(session => {
      channelPointsVIPMap.set(session.userId, session);
    });
    
    // Combine the data
    const enhancedVIPs: EnhancedVIP[] = allTwitchVIPs.map(vip => {
      const channelPointsSession = channelPointsVIPMap.get(vip.id);
      
      return {
        id: vip.id,
        username: vip.username,
        displayName: vip.displayName,
        profileImageUrl: vip.profileImageUrl,
        isChannelPointsVIP: !!channelPointsSession,
        expiresAt: channelPointsSession?.expiresAt?.toISOString(),
        grantMethod: channelPointsSession?.grantMethod,
        sessionId: channelPointsSession?.id
      };
    });
    
    // Sort: channel points VIPs first, then alphabetically by display name
    enhancedVIPs.sort((a, b) => {
      if (a.isChannelPointsVIP && !b.isChannelPointsVIP) return -1;
      if (!a.isChannelPointsVIP && b.isChannelPointsVIP) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
    
    return NextResponse.json(enhancedVIPs);
  } catch (error) {
    console.error('Error in VIP GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const result = extendSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request body', details: result.error }, { status: 400 });
    }
    
    const { sessionId, hours } = result.data;

    // Update VIP session expiration
    const updatedSession = await updateVIPSessionExpiration(
      sessionId,
      new Date(Date.now() + hours * 60 * 60 * 1000)
    );
    
    if (!updatedSession) {
      return NextResponse.json({ error: 'VIP session not found' }, { status: 404 });
    }
    
    // Log audit event
    await logAuditEvent({
      channelId: updatedSession.channelId,
      action: 'extend_vip',
      performedBy: session.user.id,
      performedByUsername: session.user.name || undefined,
      targetUserId: updatedSession.userId,
      targetUsername: updatedSession.username,
      details: {
        hours,
        newExpiresAt: updatedSession.expiresAt,
      },
    });
    
    return NextResponse.json({ 
      success: true, 
      session: updatedSession,
      message: `VIP status extended until ${updatedSession.expiresAt.toISOString()}`
    });
  } catch (error) {
    console.error('Error extending VIP session:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 