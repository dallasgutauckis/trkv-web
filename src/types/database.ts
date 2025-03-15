export interface User {
  id: string;
  twitchId: string;
  username?: string;
  displayName?: string;
  email?: string;
  profileImageUrl?: string;
  settings: UserSettings;
  tokens?: UserTokens;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserTokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  scope: string[];
}

export interface UserSettings {
  channelPointRewardId?: string;
  vipDuration: number; // in milliseconds
  autoRemoveEnabled: boolean;
  notificationsEnabled: boolean;
}

export interface VIPSession {
  id: string;
  channelId: string;
  userId: string;
  username: string;
  displayName?: string;
  isActive: boolean;
  expiresAt: Date;
  grantedAt: Date;
  grantedBy: string;
  grantedByUsername?: string;
  grantMethod: 'manual' | 'channelPoints' | 'subscription' | 'bits' | 'other';
  metadata?: Record<string, any>;
}

export interface AuditLog {
  id: string;
  channelId: string;
  action: 'grant_vip' | 'remove_vip' | 'extend_vip' | 'settings_update' | 'reward_create' | 'reward_update' | 'reward_delete';
  performedBy: string;
  performedByUsername?: string;
  targetUserId?: string;
  targetUsername?: string;
  details?: Record<string, any>;
  timestamp: Date;
}

export interface ChannelPointReward {
  id?: string;
  channelId: string;
  rewardId: string;
  title: string;
  cost: number;
  prompt?: string;
  backgroundColor?: string;
  isEnabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RedemptionMonitor {
  id: string;
  channelId: string;
  rewardId: string;
  isActive: boolean;
  lastActive?: Date;
  createdAt: Date;
  updatedAt: Date;
} 