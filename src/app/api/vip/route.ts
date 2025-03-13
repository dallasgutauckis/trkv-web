import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import * as z from 'zod';
import { grantVIPStatus, removeVIPStatus, isUserVIP } from '@/lib/twitch';
import { createVIPSession, deactivateVIPSession, getActiveVIPSessions, logAuditEvent } from '@/lib/db';
import { broadcastUpdate } from '@/lib/websocket';

const grantVIPSchema = z.object({
  userId: z.string(),
  username: z.string(),
  channelId: z.string(),
  redeemedWith: z.enum(['channel_points', 'manual']),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const json = await req.json();
    const body = grantVIPSchema.parse(json);

    // Check if user is already a VIP
    const isVip = await isUserVIP(body.channelId, body.userId);
    if (isVip) {
      return NextResponse.json(
        { error: 'User is already a VIP' },
        { status: 400 }
      );
    }

    // Grant VIP status
    const success = await grantVIPStatus(body.channelId, body.userId);
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to grant VIP status' },
        { status: 500 }
      );
    }

    // Create VIP session
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours

    const vipSession = await createVIPSession({
      channelId: body.channelId,
      userId: body.userId,
      username: body.username,
      startedAt: now,
      expiresAt,
      isActive: true,
      redeemedWith: body.redeemedWith,
    });

    // Log audit event
    await logAuditEvent({
      channelId: body.channelId,
      action: 'grant_vip',
      targetUserId: body.userId,
      targetUsername: body.username,
      performedBy: session.user?.name || 'system',
      details: {
        redeemedWith: body.redeemedWith,
        sessionId: vipSession.id,
      },
    });

    // Get updated VIP list and broadcast
    const activeSessions = await getActiveVIPSessions(body.channelId);
    broadcastUpdate(body.channelId, {
      type: 'vip_update',
      vips: activeSessions,
    });

    return NextResponse.json(vipSession);
  } catch (error) {
    console.error('Error in VIP POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
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
    broadcastUpdate(channelId, {
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
    const session = await getServerSession();
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');

    if (!channelId) {
      return NextResponse.json(
        { error: 'Missing channelId parameter' },
        { status: 400 }
      );
    }

    const activeSessions = await getActiveVIPSessions(channelId);
    return NextResponse.json(activeSessions);
  } catch (error) {
    console.error('Error in VIP GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 