import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import * as z from 'zod';
import { isUserVIP } from '@/lib/twitch';
import { getActiveVIPSessions, logAuditEvent, updateVIPSessionExpiration } from '@/lib/db';
import { broadcastToChannel } from '@/lib/sse';
import { authOptions } from '@/lib/auth';
import { VIP_SESSION_DURATION } from '@/config/twitch';

const extendVIPSchema = z.object({
  sessionId: z.string(),
  channelId: z.string(),
  userId: z.string(),
  username: z.string(),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const json = await req.json();
    const body = extendVIPSchema.parse(json);

    // Check if user is still a VIP
    const isVip = await isUserVIP(body.channelId, body.userId);
    if (!isVip) {
      return NextResponse.json(
        { error: 'User is not a VIP' },
        { status: 400 }
      );
    }

    // Get the VIP session
    const activeSessions = await getActiveVIPSessions(body.channelId);
    const vipSession = activeSessions.find(session => session.id === body.sessionId);

    if (!vipSession) {
      return NextResponse.json(
        { error: 'VIP session not found' },
        { status: 404 }
      );
    }

    // Calculate new expiration time (12 hours from current expiration)
    const currentExpiresAt = new Date(vipSession.expiresAt);
    const newExpiresAt = new Date(currentExpiresAt.getTime() + VIP_SESSION_DURATION);
    
    // Update the VIP session
    const updatedSession = await updateVIPSessionExpiration(body.sessionId, newExpiresAt);
    
    if (!updatedSession) {
      return NextResponse.json(
        { error: 'Failed to update VIP session' },
        { status: 500 }
      );
    }

    // Log audit event
    await logAuditEvent({
      channelId: body.channelId,
      action: 'grant_vip',
      targetUserId: body.userId,
      targetUsername: body.username,
      performedBy: session.user?.name || 'system',
      details: {
        action: 'extend',
        sessionId: updatedSession.id,
        previousExpiresAt: currentExpiresAt.toISOString(),
        newExpiresAt: updatedSession.expiresAt.toISOString(),
      },
    });

    // Get updated VIP list and broadcast
    const updatedSessions = await getActiveVIPSessions(body.channelId);
    broadcastToChannel(body.channelId, {
      type: 'vip_update',
      vips: updatedSessions,
    });

    return NextResponse.json({
      success: true,
      vipSession: updatedSession,
    });
  } catch (error) {
    console.error('Error in VIP extend POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 