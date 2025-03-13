import { ApiClient } from '@twurple/api';
import { AppTokenAuthProvider } from '@twurple/auth';
import { TWITCH_CONFIG } from '@/config/twitch';
import { getUser } from './db';

const authProvider = new AppTokenAuthProvider(
  TWITCH_CONFIG.clientId,
  TWITCH_CONFIG.clientSecret
);

const apiClient = new ApiClient({ authProvider });

export async function createEventSubSubscriptions(userId: string) {
  try {
    const user = await getUser(userId);
    if (!user?.settings?.channelPointRewardId) {
      throw new Error('Channel point reward not configured');
    }

    // Create subscription for channel point redemptions
    await apiClient.eventSub.createSubscription(
      'channel.channel_points_custom_reward_redemption.add',
      '1',
      {
        broadcaster_user_id: userId,
        reward_id: user.settings.channelPointRewardId
      },
      {
        method: 'webhook',
        callback: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/eventsub`,
        secret: process.env.EVENTSUB_SECRET || ''
      }
    );

    // Create subscription for VIP updates
    await apiClient.eventSub.createSubscription(
      'channel.vip.add',
      '1',
      {
        broadcaster_user_id: userId
      },
      {
        method: 'webhook',
        callback: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/eventsub`,
        secret: process.env.EVENTSUB_SECRET || ''
      }
    );

    await apiClient.eventSub.createSubscription(
      'channel.vip.remove',
      '1',
      {
        broadcaster_user_id: userId
      },
      {
        method: 'webhook',
        callback: `${process.env.NEXT_PUBLIC_BASE_URL}/api/webhooks/eventsub`,
        secret: process.env.EVENTSUB_SECRET || ''
      }
    );

    return true;
  } catch (error) {
    console.error('Error creating EventSub subscriptions:', error);
    return false;
  }
}

export async function deleteEventSubSubscriptions(userId: string) {
  try {
    const subscriptions = await apiClient.eventSub.getSubscriptions();
    
    for (const subscription of subscriptions.data) {
      if (subscription.condition.broadcaster_user_id === userId) {
        await apiClient.eventSub.deleteSubscription(subscription.id);
      }
    }

    return true;
  } catch (error) {
    console.error('Error deleting EventSub subscriptions:', error);
    return false;
  }
} 