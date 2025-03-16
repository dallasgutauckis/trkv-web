import { ApiClient } from '@twurple/api';
import { AppTokenAuthProvider } from '@twurple/auth';
import { TWITCH_CONFIG } from '@/config/twitch';
import { getUser } from './db';

const authProvider = new AppTokenAuthProvider(
  TWITCH_CONFIG.clientId,
  TWITCH_CONFIG.clientSecret
);

const apiClient = new ApiClient({ authProvider });

// [DEPRECATED] This function is no longer used as the standalone EventSub service now handles subscriptions
// Keeping for reference but marking as deprecated
/**
 * @deprecated Use the standalone EventSub service instead
 */
export async function createEventSubSubscriptions(userId: string) {
  console.warn('createEventSubSubscriptions is deprecated. Using standalone EventSub service instead.');
  return true; // Return success without creating subscriptions
}

export async function deleteEventSubSubscriptions(userId: string) {
  try {
    console.log('Cleaning up any existing EventSub subscriptions for user:', userId);
    const subscriptions = await apiClient.eventSub.getSubscriptions();
    
    for (const subscription of subscriptions.data) {
      if (subscription.condition.broadcaster_user_id === userId) {
        await apiClient.eventSub.deleteSubscription(subscription.id);
        console.log(`Deleted EventSub subscription: ${subscription.id}`);
      }
    }

    return true;
  } catch (error) {
    console.error('Error deleting EventSub subscriptions:', error);
    return false;
  }
} 