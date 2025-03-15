import { ApiClient } from '@twurple/api';
import { AppTokenAuthProvider, AccessToken, StaticAuthProvider } from '@twurple/auth';
import { TWITCH_CONFIG } from '@/config/twitch';
import type { HelixCustomReward, HelixUser } from '@twurple/api';

interface ChannelPointReward {
  id: string;
  title: string;
  cost: number;
  prompt: string;
  backgroundColor: string;
  isEnabled: boolean;
  userInputRequired: boolean;
  maxRedemptionsPerStream: number | null;
  maxRedemptionsPerUserPerStream: number | null;
  globalCooldown: number | null;
  isPaused: boolean;
  autoFulfill: boolean;
}

export interface TwitchVIP {
  id: string;
  username: string;
  displayName: string;
  profileImageUrl: string;
}

const appAuthProvider = new AppTokenAuthProvider(
  TWITCH_CONFIG.clientId,
  TWITCH_CONFIG.clientSecret
);

const appClient = new ApiClient({ authProvider: appAuthProvider });

function createUserClient(accessToken: string) {
  const authProvider = new StaticAuthProvider(TWITCH_CONFIG.clientId, accessToken, TWITCH_CONFIG.scopes);
  return new ApiClient({ authProvider });
}

/**
 * Grant VIP status to a user
 */
export async function grantVIPStatus({
  channelId,
  userId,
  username,
  grantedBy,
  grantMethod = 'manual',
  metadata = {}
}: {
  channelId: string;
  userId: string;
  username: string;
  grantedBy: string;
  grantMethod?: 'manual' | 'channelPoints' | 'subscription' | 'bits' | 'other';
  metadata?: Record<string, any>;
}) {
  try {
    const response = await fetch('/api/vip', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        channelId,
        userId,
        username,
        grantedBy,
        grantMethod,
        metadata
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      return { success: false, error: errorData.error || 'Failed to grant VIP status' };
    }

    const data = await response.json();
    return { success: true, session: data.session };
  } catch (error) {
    console.error('Error granting VIP status:', error);
    return { success: false, error: 'Failed to grant VIP status' };
  }
}

export async function removeVIPStatus(channelId: string, userId: string): Promise<boolean> {
  try {
    await appClient.channels.removeVip(channelId, userId);
    return true;
  } catch (error) {
    console.error('Error removing VIP status:', error);
    return false;
  }
}

export async function isUserVIP(channelId: string, userId: string): Promise<boolean> {
  try {
    const vips = await appClient.channels.getVips(channelId);
    return vips.data.some(vip => vip.id === userId);
  } catch (error) {
    console.error('Error checking VIP status:', error);
    return false;
  }
}

export async function getAllChannelVIPs(accessToken: string, channelId: string): Promise<TwitchVIP[]> {
  try {
    console.log('Fetching all VIPs for channel:', channelId);
    
    const authProvider = new StaticAuthProvider(TWITCH_CONFIG.clientId, accessToken);
    const apiClient = new ApiClient({ authProvider });
    
    const vips = await apiClient.channels.getVips(channelId);
    
    if (!vips || vips.data.length === 0) {
      console.log('No VIPs found for channel');
      return [];
    }
    
    // Get detailed user information for each VIP
    const formattedVIPs = await Promise.all(vips.data.map(async (vip) => {
      // For each VIP, get their detailed user information
      const userInfo = await apiClient.users.getUserById(vip.id);
      
      return {
        id: vip.id,
        username: vip.name,
        displayName: vip.displayName,
        profileImageUrl: userInfo?.profilePictureUrl || ''
      };
    }));
    
    console.log(`Found ${formattedVIPs.length} VIPs for channel`);
    return formattedVIPs;
  } catch (error) {
    console.error('Error fetching channel VIPs:', error);
    return [];
  }
}

export async function createChannelPointReward(
  channelId: string,
  title: string,
  cost: number
): Promise<string | null> {
  try {
    const reward = await appClient.channelPoints.createCustomReward(channelId, {
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

export async function getChannelPointRewards(accessToken: string, channelId: string): Promise<ChannelPointReward[]> {
  try {
    console.log('Fetching channel point rewards for channel:', channelId);
    console.log('Access token status:', accessToken ? 'Present' : 'Missing');

    const authProvider = new StaticAuthProvider(TWITCH_CONFIG.clientId, accessToken);
    const apiClient = new ApiClient({ authProvider });

    console.log('Attempting to fetch custom rewards...');
    const rewards = await apiClient.channelPoints.getCustomRewards(channelId);
    console.log('Raw rewards response:', JSON.stringify(rewards, null, 2));

    if (!rewards || rewards.length === 0) {
      console.log('No rewards found for channel');
      return [];
    }

    const formattedRewards = rewards.map(reward => ({
      id: reward.id,
      title: reward.title,
      cost: reward.cost,
      prompt: reward.prompt,
      backgroundColor: reward.backgroundColor || '#9147ff',
      isEnabled: reward.isEnabled,
      userInputRequired: reward.userInputRequired,
      maxRedemptionsPerStream: reward.maxRedemptionsPerStream,
      maxRedemptionsPerUserPerStream: reward.maxRedemptionsPerUserPerStream,
      globalCooldown: reward.globalCooldown,
      isPaused: reward.isPaused,
      autoFulfill: reward.autoFulfill
    }));

    console.log('Formatted rewards:', JSON.stringify(formattedRewards, null, 2));
    return formattedRewards;
  } catch (error) {
    console.error('Error fetching channel point rewards:', error);
    throw error;
  }
}

/**
 * Fetch channel point rewards for the current user
 */
export async function fetchChannelPointRewards() {
  try {
    const response = await fetch('/api/channel-points', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Failed to fetch channel point rewards');
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Error fetching channel point rewards:', error);
    return { success: false, error: 'Failed to fetch rewards' };
  }
} 