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

// Schema for update request
const updateMonitorSchema = z.object({
  channelId: z.string(),
  rewardId: z.string().optional(),
  isActive: z.boolean()
});

export async function GET(request: NextRequest) {
  try {
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
      error: 'Internal server error',
      message: 'Failed to get redemption monitor status',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const result = updateMonitorSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ 
        error: 'Invalid request body',
        details: result.error.format()
      }, { status: 400 });
    }
    
    const { channelId, rewardId, isActive } = result.data;

    // Get user to verify ownership
    const user = await getUser(session.user.id);
    if (!user || user.twitchId !== channelId) {
      return NextResponse.json({ error: 'Unauthorized to access this channel' }, { status: 403 });
    }

    // Add rate limiting to prevent too many requests
    const rateLimitKey = `monitor_update_${channelId}`;
    const rateLimitDoc = await db.collection('rateLimits').doc(rateLimitKey).get();
    const rateLimitData = rateLimitDoc.data();
    
    if (rateLimitData && rateLimitData.lastUpdate) {
      const lastUpdate = rateLimitData.lastUpdate.toDate();
      const timeSinceLastUpdate = Date.now() - lastUpdate.getTime();
      
      // Rate limit to one update per 10 seconds
      if (timeSinceLastUpdate < 10000) {
        return NextResponse.json({ 
          error: 'Rate limited',
          message: 'Please wait before making another request',
          retryAfter: Math.ceil((10000 - timeSinceLastUpdate) / 1000)
        }, { status: 429 });
      }
    }
    
    // Update rate limit
    await db.collection('rateLimits').doc(rateLimitKey).set({
      lastUpdate: new Date(),
      channelId
    });

    // Update monitoring status
    let success = false;
    
    if (isActive) {
      if (!rewardId) {
        return NextResponse.json({ error: 'rewardId is required when enabling monitoring' }, { status: 400 });
      }
      
      // Store the monitoring settings in the database first
      await db.collection('monitorSettings').doc(channelId).set({
        channelId,
        rewardId,
        isActive: true,
        updatedAt: new Date()
      }, { merge: true });
      
      // Then try to start the monitoring
      success = await startRedemptionMonitoring(channelId, rewardId);
      
      if (!success) {
        // If failed, update the database to reflect the failure
        await db.collection('monitorSettings').doc(channelId).update({
          isActive: false,
          lastError: 'Failed to start monitoring',
          lastErrorTime: new Date()
        });
      }
    } else {
      // Store the monitoring settings in the database first
      await db.collection('monitorSettings').doc(channelId).set({
        channelId,
        rewardId: rewardId || null,
        isActive: false,
        updatedAt: new Date()
      }, { merge: true });
      
      // Then try to stop the monitoring
      success = await stopRedemptionMonitoring(channelId);
    }
    
    if (!success) {
      return NextResponse.json({ 
        error: 'Failed to update monitoring status',
        message: isActive ? 'Failed to start monitoring' : 'Failed to stop monitoring'
      }, { status: 500 });
    }
    
    // Get updated status
    const status = await getRedemptionMonitorStatus(channelId);
    
    return NextResponse.json({ 
      success: true,
      monitor: status || { isActive: false, rewardId: null }
    });
  } catch (error) {
    console.error('Error updating redemption monitor:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'Failed to update redemption monitor',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
} 