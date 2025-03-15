import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getActiveListeners } from '@/services/twitch-eventsub';

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
    const listeners = getActiveListeners();
    
    // Format the response
    const formattedListeners = Array.from(listeners.entries()).map(([channelId, data]) => ({
      channelId,
      rewardId: data.rewardId,
      isListenerActive: !!data.listener,
      hasSubscription: !!data.subscription,
    }));
    
    return NextResponse.json({ 
      activeListeners: formattedListeners,
      count: formattedListeners.length
    });
  } catch (error) {
    console.error('Error getting EventSub debug info:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'Failed to get EventSub debug info',
      details: String(error)
    }, { status: 500 });
  }
} 