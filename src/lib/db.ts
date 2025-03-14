import type { User, VIPSession, AuditLog, ChannelPointReward, UserSettings } from '@/types/database';

// In-memory storage
const users = new Map<string, User>();
const vipSessions = new Map<string, VIPSession>();
const auditLogs = new Map<string, AuditLog>();
const channelPointRewards = new Map<string, ChannelPointReward>();

export async function getUser(id: string): Promise<User | null> {
  return users.get(id) || null;
}

export async function createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
  const now = new Date();
  const userData: User = {
    ...user,
    id: user.twitchId,
    createdAt: now,
    updatedAt: now,
    settings: {
      ...user.settings, // Use provided settings first
      // Then apply defaults for any missing properties
      vipDuration: user.settings?.vipDuration ?? 12 * 60 * 60 * 1000, // 12 hours
      autoRemoveEnabled: user.settings?.autoRemoveEnabled ?? true,
      notificationsEnabled: user.settings?.notificationsEnabled ?? true,
    },
  };
  
  users.set(userData.id, userData);
  return userData;
}

export async function getActiveVIPSessions(channelId: string): Promise<VIPSession[]> {
  return Array.from(vipSessions.values()).filter(
    session => session.isActive && (!channelId || session.channelId === channelId)
  );
}

export async function createVIPSession(session: Omit<VIPSession, 'id'>): Promise<VIPSession> {
  const id = Math.random().toString(36).substring(2);
  const sessionData: VIPSession = {
    ...session,
    id,
  };
  
  vipSessions.set(id, sessionData);
  return sessionData;
}

export async function deactivateVIPSession(sessionId: string): Promise<void> {
  const session = vipSessions.get(sessionId);
  if (session) {
    session.isActive = false;
    vipSessions.set(sessionId, session);
  }
}

export async function updateVIPSessionExpiration(sessionId: string, newExpiresAt: Date): Promise<VIPSession | null> {
  const session = vipSessions.get(sessionId);
  if (session) {
    session.expiresAt = newExpiresAt;
    vipSessions.set(sessionId, session);
    return session;
  }
  return null;
}

export async function logAuditEvent(event: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  const id = Math.random().toString(36).substring(2);
  const auditLog: AuditLog = {
    ...event,
    id,
    timestamp: new Date(),
  };
  
  auditLogs.set(id, auditLog);
}

export async function getChannelPointReward(channelId: string): Promise<ChannelPointReward | null> {
  for (const reward of channelPointRewards.values()) {
    if (reward.channelId === channelId) {
      return reward;
    }
  }
  return null;
}

export async function updateChannelPointReward(reward: ChannelPointReward): Promise<void> {
  channelPointRewards.set(reward.id, reward);
}

export async function updateUserSettings(userId: string, settings: UserSettings): Promise<void> {
  const user = users.get(userId);
  if (user) {
    user.settings = settings;
    user.updatedAt = new Date();
    users.set(userId, user);
  }
} 