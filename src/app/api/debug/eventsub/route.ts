import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUser } from '@/lib/db';
import { getActiveListeners } from '@/services/eventsub-manager';

export async function GET(request: NextRequest) {
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

    // Get active listeners
    const activeListeners = getActiveListeners();
    
    // Format the response
    const formattedListeners = Array.from(activeListeners.entries()).map(([channelId, data]) => ({
      channelId,
      rewardId: data.rewardId,
      isListenerActive: !!data.listener,
      hasSubscription: !!data.subscription
    }));
    
    return NextResponse.json({ 
      listeners: formattedListeners,
      count: formattedListeners.length
    });
  } catch (error) {
    console.error('Error getting active listeners:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'Failed to get active listeners',
      details: String(error)
    }, { status: 500 });
  }
} 