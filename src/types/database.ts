export interface User {
  id: string;
  twitchId: string;
  username: string;
  email: string;
  createdAt: Date;
  updatedAt: Date;
  settings: UserSettings;
}

export interface UserSettings {
  channelPointRewardId?: string;
  vipDuration: number; // Duration in milliseconds
  autoRemoveEnabled: boolean;
  notificationsEnabled: boolean;
}

export interface VIPSession {
  id: string;
  channelId: string;
  userId: string;
  username: string;
  startedAt: Date;
  expiresAt: Date;
  isActive: boolean;
  redeemedWith: 'channel_points' | 'manual';
}

export interface ChannelPointReward {
  id: string;
  channelId: string;
  title: string;
  cost: number;
  isEnabled: boolean;
  autoFulfill: boolean;
}

export interface AuditLog {
  id: string;
  channelId: string;
  action: 'grant_vip' | 'remove_vip' | 'settings_update';
  targetUserId?: string;
  targetUsername?: string;
  performedBy: string;
  timestamp: Date;
  details: Record<string, any>;
} 