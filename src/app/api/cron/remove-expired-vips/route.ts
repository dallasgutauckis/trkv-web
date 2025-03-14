import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { removeVIPStatus } from '@/lib/twitch';
import { getActiveVIPSessions, deactivateVIPSession, logAuditEvent } from '@/lib/db';
import type { VIPSession } from '@/types/database';
import { broadcastToChannel } from '@/lib/sse';

// Verify request is from Cloud Scheduler
async function isAuthorizedRequest() {
  const headersList = await headers();
  const authHeader = headersList.get('Authorization') || '';
  return authHeader === `Bearer ${process.env.CRON_SECRET}`;
}

export async function POST() {
  try {
    if (!await isAuthorizedRequest()) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const now = new Date();
    const channels = new Map<string, VIPSession[]>();

    // Get all active VIP sessions
    const allActiveSessions = await getActiveVIPSessions('');

    // Group expired sessions by channel
    allActiveSessions.forEach(session => {
      if (new Date(session.expiresAt) <= now) {
        const channelSessions = channels.get(session.channelId) || [];
        channelSessions.push(session);
        channels.set(session.channelId, channelSessions);
      }
    });

    // Process expired sessions for each channel
    for (const [channelId, sessions] of channels.entries()) {
      for (const session of sessions) {
        // Remove VIP status
        const success = await removeVIPStatus(channelId, session.userId);
        
        if (success) {
          // Deactivate VIP session
          await deactivateVIPSession(session.id);

          // Log audit event
          await logAuditEvent({
            channelId,
            action: 'remove_vip',
            targetUserId: session.userId,
            targetUsername: session.username,
            performedBy: 'system',
            details: {
              sessionId: session.id,
              reason: 'expired',
              expirationTime: session.expiresAt,
            },
          });
        }
      }
    }

    return NextResponse.json({
      success: true,
      processedChannels: channels.size,
      totalSessions: Array.from(channels.values()).flat().length,
    });
  } catch (error) {
    console.error('Error removing expired VIPs:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 