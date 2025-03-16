import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { grantVIPStatus } from '@/lib/twitch';
import { getUserTokens, logAuditLog } from '@/lib/db';
import type { UserTokens } from '@/types/database';
import type { EventSubSubscription } from '@twurple/eventsub-base';

// Map to store active listeners by channel ID
const activeListeners = new Map<string, { listener: EventSubWsListener, subscriptions: EventSubSubscription[] }>();

/**
 * Start monitoring channel point redemptions for a specific channel
 * @param channelId The Twitch channel ID to monitor
 * @param rewardId The channel point reward ID to listen for
 * @param tokens The user's Twitch tokens
 */
export async function startMonitoringRedemptions(
  channelId: string, 
  rewardId: string, 
  tokens: UserTokens
): Promise<void> {
  try {
    console.log(`Starting redemption monitoring for channel ${channelId}, reward ${rewardId}`);
    
    // Check if already monitoring
    if (activeListeners.has(channelId)) {
      console.log(`Already monitoring channel ${channelId}, refreshing subscription`);
      await stopMonitoringRedemptions(channelId);
    }
    
    // Create auth provider with token refresh
    const authProvider = new RefreshingAuthProvider({
      clientId: process.env.TWITCH_CLIENT_ID!,
      clientSecret: process.env.TWITCH_CLIENT_SECRET!,
    });
    
    // Initialize with tokens
    await authProvider.addUserForToken({
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: Math.floor((tokens.expiresAt.getTime() - Date.now()) / 1000),
      obtainmentTimestamp: Date.now(),
      scope: tokens.scope,
    }, ['channel:manage:redemptions', 'channel:read:redemptions', 'moderator:manage:chat_settings']);
    
    // Create API client
    const apiClient = new ApiClient({ authProvider });
    
    // Create EventSub listener
    const listener = new EventSubWsListener({ apiClient });
    await listener.start();
    
    // Subscribe to channel point redemption events
    const subscription = await listener.onChannelRedemptionAdd(channelId, async (event) => {
      try {
        // Check if this is the reward we're looking for
        if (event.rewardId === rewardId) {
          console.log(`Redemption detected for channel ${channelId}, user ${event.userDisplayName}`);
          
          // Grant VIP status
          const result = await grantVIPStatus({
            channelId,
            userId: event.userId,
            username: event.userDisplayName,
            grantedBy: channelId, // The channel owner is granting
            grantMethod: 'channelPoints',
            metadata: {
              rewardId,
              rewardTitle: event.rewardTitle,
              rewardCost: event.rewardCost,
              redemptionId: event.id
            }
          });
          
          if (result.success) {
            console.log(`VIP status granted to ${event.userDisplayName} via channel points`);
            
            // Log the event
            await logAuditLog({
              channelId,
              action: 'grant_vip',
              performedBy: channelId,
              performedByUsername: 'System (Channel Points)',
              targetUserId: event.userId,
              targetUsername: event.userDisplayName,
              details: {
                grantMethod: 'channelPoints',
                rewardId,
                rewardTitle: event.rewardTitle,
                rewardCost: event.rewardCost,
                redemptionId: event.id,
                vipSession: result.session
              }
            });
          } else {
            console.error(`Failed to grant VIP status: ${result.error}`);
          }
        }
      } catch (error) {
        console.error('Error processing redemption:', error);
      }
    });
    
    // Store the listener and subscription
    activeListeners.set(channelId, { 
      listener, 
      subscriptions: [subscription] 
    });
    
    console.log(`Redemption monitoring started for channel ${channelId}`);
  } catch (error) {
    console.error(`Error starting redemption monitoring for channel ${channelId}:`, error);
    throw error;
  }
}

/**
 * Stop monitoring channel point redemptions for a specific channel
 * @param channelId The Twitch channel ID to stop monitoring
 */
export async function stopMonitoringRedemptions(channelId: string): Promise<void> {
  try {
    const listenerData = activeListeners.get(channelId);
    if (!listenerData) {
      console.log(`No active listener for channel ${channelId}`);
      return;
    }
    
    // Unsubscribe from all subscriptions
    for (const subscription of listenerData.subscriptions) {
      try {
        // Use the subscription's own unsubscribe method
        await subscription.stop();
      } catch (error) {
        console.error(`Error unsubscribing from subscription for channel ${channelId}:`, error);
      }
    }
    
    // Stop the listener
    try {
      await listenerData.listener.stop();
    } catch (error) {
      console.error(`Error stopping listener for channel ${channelId}:`, error);
    }
    
    // Remove from active listeners
    activeListeners.delete(channelId);
    
    console.log(`Redemption monitoring stopped for channel ${channelId}`);
  } catch (error) {
    console.error(`Error stopping redemption monitoring for channel ${channelId}:`, error);
    throw error;
  }
}

/**
 * Refresh all active redemption monitors
 * This should be called on server startup to restore monitoring
 */
export async function refreshAllMonitors(): Promise<void> {
  try {
    // This would typically be called from a server initialization function
    // It would get all active monitors from the database and start them
    console.log('Refreshing all redemption monitors');
    
    // Implementation would depend on how monitors are stored
    // For example:
    // const activeMonitors = await getActiveRedemptionMonitors();
    // for (const monitor of activeMonitors) {
    //   const tokens = await getUserTokens(monitor.channelId);
    //   if (tokens) {
    //     await startMonitoringRedemptions(monitor.channelId, monitor.rewardId, tokens);
    //   }
    // }
  } catch (error) {
    console.error('Error refreshing redemption monitors:', error);
  }
} 