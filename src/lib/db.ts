import type { User, VIPSession, AuditLog, ChannelPointReward, UserSettings } from '@/types/database';
import { db } from './firebase';
import { FieldValue } from 'firebase-admin/firestore';

// Collection references
const usersCollection = db.collection('users');
const vipSessionsCollection = db.collection('vipSessions');
const auditLogsCollection = db.collection('auditLogs');
const channelPointRewardsCollection = db.collection('channelPointRewards');

// In-memory cache for frequently accessed data
const userCache = new Map<string, User>();
const vipSessionCache = new Map<string, VIPSession>();

// Helper function to convert Firestore document to our type
function convertFirestoreDoc<T>(doc: FirebaseFirestore.DocumentSnapshot): T | null {
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() } as T;
}

export async function getUser(id: string): Promise<User | null> {
  // Check cache first
  if (userCache.has(id)) {
    return userCache.get(id) || null;
  }

  try {
    const userDoc = await usersCollection.doc(id).get();
    const user = convertFirestoreDoc<User>(userDoc);
    
    if (user) {
      // Update cache
      userCache.set(id, user);
    }
    
    return user;
  } catch (error) {
    console.error(`Error getting user ${id}:`, error);
    return null;
  }
}

export async function createUser(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
  const now = new Date();
  const userData: Omit<User, 'id'> = {
    ...user,
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
  
  try {
    const userRef = usersCollection.doc(user.twitchId);
    await userRef.set(userData);
    
    const createdUser = { id: user.twitchId, ...userData } as User;
    
    // Update cache
    userCache.set(createdUser.id, createdUser);
    
    return createdUser;
  } catch (error) {
    console.error('Error creating user:', error);
    throw error;
  }
}

export async function getActiveVIPSessions(channelId: string): Promise<VIPSession[]> {
  try {
    let query = vipSessionsCollection.where('isActive', '==', true);
    
    if (channelId) {
      query = query.where('channelId', '==', channelId);
    }
    
    const snapshot = await query.get();
    return snapshot.docs.map(doc => convertFirestoreDoc<VIPSession>(doc)!);
  } catch (error) {
    console.error('Error getting active VIP sessions:', error);
    return [];
  }
}

export async function createVIPSession(session: Omit<VIPSession, 'id'>): Promise<VIPSession> {
  try {
    const sessionRef = vipSessionsCollection.doc();
    await sessionRef.set(session);
    
    const createdSession = { id: sessionRef.id, ...session } as VIPSession;
    
    // Update cache
    vipSessionCache.set(createdSession.id, createdSession);
    
    return createdSession;
  } catch (error) {
    console.error('Error creating VIP session:', error);
    throw error;
  }
}

export async function deactivateVIPSession(sessionId: string): Promise<void> {
  try {
    await vipSessionsCollection.doc(sessionId).update({
      isActive: false
    });
    
    // Update cache if exists
    if (vipSessionCache.has(sessionId)) {
      const session = vipSessionCache.get(sessionId)!;
      session.isActive = false;
      vipSessionCache.set(sessionId, session);
    }
  } catch (error) {
    console.error(`Error deactivating VIP session ${sessionId}:`, error);
    throw error;
  }
}

export async function updateVIPSessionExpiration(sessionId: string, newExpiresAt: Date): Promise<VIPSession | null> {
  try {
    await vipSessionsCollection.doc(sessionId).update({
      expiresAt: newExpiresAt
    });
    
    // Get updated session
    const sessionDoc = await vipSessionsCollection.doc(sessionId).get();
    const updatedSession = convertFirestoreDoc<VIPSession>(sessionDoc);
    
    if (updatedSession) {
      // Update cache
      vipSessionCache.set(sessionId, updatedSession);
    }
    
    return updatedSession;
  } catch (error) {
    console.error(`Error updating VIP session expiration ${sessionId}:`, error);
    return null;
  }
}

export async function logAuditEvent(event: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    const auditLog: Omit<AuditLog, 'id'> = {
      ...event,
      timestamp: new Date(),
    };
    
    await auditLogsCollection.add(auditLog);
  } catch (error) {
    console.error('Error logging audit event:', error);
    // Don't throw error for logging failures
  }
}

export async function getChannelPointReward(channelId: string): Promise<ChannelPointReward | null> {
  try {
    const snapshot = await channelPointRewardsCollection
      .where('channelId', '==', channelId)
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    
    return convertFirestoreDoc<ChannelPointReward>(snapshot.docs[0]);
  } catch (error) {
    console.error(`Error getting channel point reward for channel ${channelId}:`, error);
    return null;
  }
}

export async function updateChannelPointReward(reward: ChannelPointReward): Promise<void> {
  try {
    if (reward.id) {
      await channelPointRewardsCollection.doc(reward.id).set(reward);
    } else {
      await channelPointRewardsCollection.add(reward);
    }
  } catch (error) {
    console.error('Error updating channel point reward:', error);
    throw error;
  }
}

export async function updateUserSettings(userId: string, settings: UserSettings): Promise<void> {
  try {
    await usersCollection.doc(userId).update({
      settings: settings,
      updatedAt: FieldValue.serverTimestamp()
    });
    
    // Update cache if exists
    if (userCache.has(userId)) {
      const user = userCache.get(userId)!;
      user.settings = settings;
      user.updatedAt = new Date();
      userCache.set(userId, user);
    }
  } catch (error) {
    console.error(`Error updating user settings for ${userId}:`, error);
    throw error;
  }
} 