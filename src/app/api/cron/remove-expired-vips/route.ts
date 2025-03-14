import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { removeVIPStatus } from '@/lib/twitch';
import { getActiveVIPSessions, deactivateVIPSession, logAuditEvent } from '@/lib/db';
import { broadcastToChannel } from '@/app/api/ws/route';
import type { VIPSession } from '@/types/database';

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
    const processedChannels = new Set<string>();

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
      let channelUpdated = false;
      
      for (const session of sessions) {
        // Remove VIP status
        const success = await removeVIPStatus(channelId, session.userId);
        
        if (success) {
          // Deactivate VIP session
          await deactivateVIPSession(session.id);
          channelUpdated = true;

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
      
      // If any VIPs were removed, broadcast the update to connected clients
      if (channelUpdated) {
        processedChannels.add(channelId);
        
        // Get updated VIP list for this channel
        const updatedSessions = await getActiveVIPSessions(channelId);
        
        // Broadcast the update
        broadcastToChannel(channelId, {
          type: 'vip_update',
          vips: updatedSessions,
          timestamp: new Date().toISOString(),
          source: 'cron_job'
        });
      }
    }

    return NextResponse.json({
      success: true,
      processedChannels: processedChannels.size,
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