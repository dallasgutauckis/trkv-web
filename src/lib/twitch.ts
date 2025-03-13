import { ApiClient } from '@twurple/api';
import { AppTokenAuthProvider } from '@twurple/auth';
import { TWITCH_CONFIG } from '@/config/twitch';

const authProvider = new AppTokenAuthProvider(
  TWITCH_CONFIG.clientId,
  TWITCH_CONFIG.clientSecret
);

const apiClient = new ApiClient({ authProvider });

export async function grantVIPStatus(channelId: string, userId: string): Promise<boolean> {
  try {
    await apiClient.channels.addVip(channelId, userId);
    return true;
  } catch (error) {
    console.error('Error granting VIP status:', error);
    return false;
  }
}

export async function removeVIPStatus(channelId: string, userId: string): Promise<boolean> {
  try {
    await apiClient.channels.removeVip(channelId, userId);
    return true;
  } catch (error) {
    console.error('Error removing VIP status:', error);
    return false;
  }
}

export async function isUserVIP(channelId: string, userId: string): Promise<boolean> {
  try {
    const vips = await apiClient.channels.getVips(channelId);
    return vips.data.some(vip => vip.id === userId);
  } catch (error) {
    console.error('Error checking VIP status:', error);
    return false;
  }
}

export async function createChannelPointReward(
  channelId: string,
  title: string,
  cost: number
): Promise<string | null> {
  try {
    const reward = await apiClient.channelPoints.createCustomReward(channelId, {
      title,
      cost,
      isEnabled: true,
      autoFulfill: false,
      backgroundColor: '#9147ff',
      globalCooldown: 0,
      maxRedemptionsPerStream: null,
      maxRedemptionsPerUserPerStream: 1,
      prompt: 'Redeem to receive VIP status for 12 hours!',
    });
    
    return reward.id;
  } catch (error) {
    console.error('Error creating channel point reward:', error);
    return null;
  }
} 