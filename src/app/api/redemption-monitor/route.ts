import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUser } from '@/lib/db';
import { 
  startRedemptionMonitoring, 
  stopRedemptionMonitoring, 
  getRedemptionMonitorStatus 
} from '@/services/eventsub-manager';
import { z } from 'zod';
import { db } from '@/lib/firebase';
import { ensureEventSubMonitoring } from '@/server';

// Schema for update request
const updateMonitorSchema = z.object({
  channelId: z.string(),
  rewardId: z.string().optional(),
  isActive: z.boolean()
});

export async function GET(request: NextRequest) {
  try {
    // Ensure EventSub monitoring is running
    await ensureEventSubMonitoring();

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const url = new URL(request.url);
    const channelId = url.searchParams.get('channelId');

    if (!channelId) {
      return NextResponse.json({ error: 'Missing channelId parameter' }, { status: 400 });
    }

    // Get user to verify ownership
    const user = await getUser(session.user.id);
    if (!user || user.twitchId !== channelId) {
      return NextResponse.json({ error: 'Unauthorized to access this channel' }, { status: 403 });
    }

    // Get monitoring status
    const status = await getRedemptionMonitorStatus(channelId);
    
    return NextResponse.json({ 
      monitor: status || { isActive: false, rewardId: null }
    });
  } catch (error) {
    console.error('Error getting redemption monitor status:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Ensure EventSub monitoring is running
    await ensureEventSubMonitoring();

    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    const result = updateMonitorSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    const { channelId, rewardId, isActive } = result.data;

    // Get user to verify ownership
    const user = await getUser(session.user.id);
    if (!user || user.twitchId !== channelId) {
      return NextResponse.json({ error: 'Unauthorized to access this channel' }, { status: 403 });
    }

    // Update monitoring status
    if (isActive) {
      if (!rewardId) {
        return NextResponse.json({ error: 'rewardId is required when enabling monitoring' }, { status: 400 });
      }

      // Start monitoring
      const success = await startRedemptionMonitoring(channelId, rewardId);
      if (!success) {
        return NextResponse.json({ error: 'Failed to start monitoring' }, { status: 500 });
      }

      // Update database
      await db.collection('monitorSettings').doc(channelId).set({
        channelId,
        rewardId,
        isActive: true,
        updatedAt: new Date()
      });
    } else {
      // Stop monitoring
      await stopRedemptionMonitoring(channelId);

      // Update database
      if (rewardId) {
        await db.collection('monitorSettings').doc(channelId).update({
          isActive: false,
          updatedAt: new Date()
        });
      } else {
        await db.collection('monitorSettings').doc(channelId).set({
          channelId,
          rewardId: null,
          isActive: false,
          updatedAt: new Date()
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating redemption monitor:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 