import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUser } from '@/lib/db';
import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import { TWITCH_CONFIG } from '@/config/twitch';
import { activeListeners } from '@/services/eventsub-manager';

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

    // Check if we have an active listener for this channel
    const listener = activeListeners.get(channelId);
    
    // Initialize response object
    const response: {
      channelId: string;
      rewardId: string;
      isListenerActive: boolean;
      hasSubscription: boolean;
      subscriptionId?: string;
      subscriptionStatus?: string;
      subscriptionType?: string;
      error?: string;
    } = {
      channelId,
      rewardId: listener?.rewardId || '',
      isListenerActive: !!listener,
      hasSubscription: !!(listener?.subscription),
    };
    
    // If we have a listener, add more details
    if (listener) {
      response.rewardId = listener.rewardId;
      
      // Try to get more details about the subscription
      try {
        if (user.tokens) {
          // Create auth provider
          const authProvider = new RefreshingAuthProvider({
            clientId: TWITCH_CONFIG.clientId,
            clientSecret: TWITCH_CONFIG.clientSecret,
          });
          
          // Add user to auth provider
          await authProvider.addUser(channelId, {
            accessToken: user.tokens.accessToken,
            refreshToken: user.tokens.refreshToken,
            expiresIn: Math.floor((new Date(user.tokens.expiresAt).getTime() - Date.now()) / 1000),
            obtainmentTimestamp: Date.now(),
            scope: user.tokens.scope
          });
          
          // Create API client
          const apiClient = new ApiClient({ authProvider });
          
          // Get subscriptions
          const subscriptions = await apiClient.eventSub.getSubscriptions();
          
          // Find subscription for this channel
          const subscription = subscriptions.data.find(sub => 
            sub.type === 'channel.channel_points_custom_reward_redemption.add' &&
            sub.condition && 
            typeof sub.condition === 'object' &&
            'broadcaster_user_id' in sub.condition &&
            sub.condition.broadcaster_user_id === channelId
          );
          
          if (subscription) {
            response.subscriptionId = subscription.id;
            response.subscriptionStatus = subscription.status;
            response.subscriptionType = subscription.type;
            
            // Check if the subscription is for the correct reward
            if (subscription.condition && 
                typeof subscription.condition === 'object' &&
                'reward' in subscription.condition &&
                subscription.condition.reward &&
                typeof subscription.condition.reward === 'object' &&
                'id' in subscription.condition.reward &&
                subscription.condition.reward.id !== listener.rewardId) {
              response.error = `Subscription is for a different reward ID: ${subscription.condition.reward.id}`;
            }
          } else {
            response.error = 'No active subscription found on Twitch';
          }
        } else {
          response.error = 'User tokens not found';
        }
      } catch (error) {
        console.error('Error getting subscription details:', error);
        response.error = error instanceof Error ? error.message : String(error);
      }
    } else {
      response.error = 'No active listener found';
    }
    
    return NextResponse.json(response);
  } catch (error) {
    console.error('Error checking EventSub status:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'Failed to check EventSub status',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
} 