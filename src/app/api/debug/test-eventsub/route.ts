import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUser } from '@/lib/db';
import { startRedemptionMonitoring, stopRedemptionMonitoring } from '@/services/eventsub-manager';

export async function POST(request: NextRequest) {
  try {
    // Only allow in development mode
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ error: 'This endpoint is only available in development mode' }, { status: 403 });
    }
    
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { channelId, rewardId, action } = body;

    if (!channelId || !rewardId) {
      return NextResponse.json({ error: 'Missing channelId or rewardId' }, { status: 400 });
    }

    // Get user to verify ownership
    const user = await getUser(session.user.id);
    if (!user || user.twitchId !== channelId) {
      return NextResponse.json({ error: 'Unauthorized to access this channel' }, { status: 403 });
    }

    // Perform the requested action
    if (action === 'start') {
      console.log(`[Test] Manually starting EventSub monitoring for channel ${channelId} and reward ${rewardId}`);
      
      // First stop any existing monitoring
      await stopRedemptionMonitoring(channelId);
      
      // Then start monitoring
      const result = await startRedemptionMonitoring(channelId, rewardId);
      
      if (result) {
        return NextResponse.json({ 
          success: true, 
          message: `Successfully started monitoring for channel ${channelId} and reward ${rewardId}`
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          message: `Failed to start monitoring for channel ${channelId} and reward ${rewardId}`
        }, { status: 500 });
      }
    } else if (action === 'stop') {
      console.log(`[Test] Manually stopping EventSub monitoring for channel ${channelId}`);
      
      const result = await stopRedemptionMonitoring(channelId);
      
      if (result) {
        return NextResponse.json({ 
          success: true, 
          message: `Successfully stopped monitoring for channel ${channelId}`
        });
      } else {
        return NextResponse.json({ 
          success: false, 
          message: `Failed to stop monitoring for channel ${channelId}`
        }, { status: 500 });
      }
    } else {
      return NextResponse.json({ error: 'Invalid action. Must be "start" or "stop"' }, { status: 400 });
    }
  } catch (error) {
    console.error('Error in test-eventsub endpoint:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'Failed to perform test action',
      details: String(error)
    }, { status: 500 });
  }
} 