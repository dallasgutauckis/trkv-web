import { ApiClient } from '@twurple/api';
import { RefreshingAuthProvider } from '@twurple/auth';
import { EventSubWsListener } from '@twurple/eventsub-ws';
import { db } from '@/lib/firebase';
import { getUser, updateVIPSessionExpiration, createVIPSession, updateUserTokens } from '@/lib/db';
import { TWITCH_CONFIG } from '@/config/twitch';

// Enable debug mode for development
const DEBUG = process.env.NODE_ENV === 'development';

// Store active listeners by channel ID
export const activeListeners: Map<string, { 
  listener: EventSubWsListener, 
  subscription: any,
  rewardId: string 
}> = new Map();

// Store event emitters for real-time updates
const eventEmitters: Set<(event: EventSubEvent) => void> = new Set();

// Debug log function
function debugLog(...args: any[]) {
  if (DEBUG) {
    console.log('[EventSub Debug]', ...args);
  }
}

// Event types for real-time updates
export type EventSubEventType = 'VIP_GRANTED' | 'VIP_EXTENDED' | 'VIP_GRANT_FAILED' | 'SUBSCRIPTION_CREATED' | 'SUBSCRIPTION_FAILED';

export interface EventSubEvent {
  type: EventSubEventType;
  channelId: string;
  timestamp: Date;
  data?: any;
}

// Subscribe to EventSub events
export function subscribeToEvents(callback: (event: EventSubEvent) => void): () => void {
  eventEmitters.add(callback);
  
  // Return unsubscribe function
  return () => {
    eventEmitters.delete(callback);
  };
}

/**
 * Emit an event to all subscribers
 */
export function emitEvent(event: EventSubEvent): void {
  // Add timestamp if not present
  if (!event.timestamp) {
    event.timestamp = new Date();
  }
  
  // Ensure channelId is present
  if (!event.channelId) {
    console.error('Event missing channelId:', event);
    return;
  }
  
  // Log the event
  debugLog(`Emitting event: ${event.type} for channel ${event.channelId}`, event.data);
  
  // Make a copy of the event to avoid reference issues
  const eventCopy = JSON.parse(JSON.stringify(event));
  
  // Convert timestamp to ISO string for transmission
  if (eventCopy.timestamp instanceof Date) {
    eventCopy.timestamp = eventCopy.timestamp.toISOString();
  }
  
  // Emit to all subscribers
  let subscriberCount = 0;
  for (const callback of eventEmitters) {
    try {
      callback(eventCopy);
      subscriberCount++;
    } catch (error) {
      console.error('Error in event subscriber callback:', error);
    }
  }
  
  console.log(`Event ${event.type} emitted to ${subscriberCount} subscribers`);
}

/**
 * Add an entry to the audit log
 */
export async function addAuditLog(entry: {
  channelId: string;
  action: string;
  username: string;
  userId: string;
  details?: Record<string, any>;
}): Promise<void> {
  try {
    // Add timestamp
    const timestamp = new Date();
    
    // Add to audit log collection
    const docRef = await db.collection('auditLogs').add({
      ...entry,
      timestamp
    });
    
    console.log(`Added audit log entry: ${entry.action} for ${entry.username} in channel ${entry.channelId}`);
    
    // Map audit log actions to event types
    const eventTypeMap: Record<string, EventSubEventType> = {
      'VIP_GRANTED': 'VIP_GRANTED',
      'VIP_EXTENDED': 'VIP_EXTENDED',
      'VIP_GRANT_FAILED': 'VIP_GRANT_FAILED'
    };
    
    // Emit event for real-time updates if it's a known event type
    if (eventTypeMap[entry.action]) {
      emitEvent({
        type: eventTypeMap[entry.action],
        channelId: entry.channelId,
        timestamp,
        data: {
          username: entry.username,
          userId: entry.userId,
          details: entry.details,
          logId: docRef.id // Include the log ID for reference
        }
      });
    }
  } catch (error) {
    console.error('Error adding audit log entry:', error);
  }
}

/**
 * Start monitoring channel point redemptions for a specific channel
 */
export async function startRedemptionMonitoring(channelId: string, rewardId: string): Promise<boolean> {
  try {
    debugLog(`Starting redemption monitoring for channel ${channelId} and reward ${rewardId}`);
    console.log(`[EventSub] Starting redemption monitoring for channel ${channelId} and reward ${rewardId}`);
    
    // Check if already monitoring
    if (activeListeners.has(channelId)) {
      const existing = activeListeners.get(channelId);
      if (existing?.rewardId === rewardId) {
        debugLog(`Already monitoring channel ${channelId} for reward ${rewardId}`);
        console.log(`[EventSub] Already monitoring channel ${channelId} for reward ${rewardId}`);
        
        // Update the database to ensure it reflects the active status
        await db.collection('monitorSettings').doc(channelId).set({
          channelId,
          rewardId,
          isActive: true,
          updatedAt: new Date()
        }, { merge: true });
        
        return true;
      }
      
      // If monitoring a different reward, stop the current monitoring
      debugLog(`Switching monitored reward for channel ${channelId} from ${existing?.rewardId} to ${rewardId}`);
      console.log(`[EventSub] Switching monitored reward for channel ${channelId} from ${existing?.rewardId} to ${rewardId}`);
      await stopRedemptionMonitoring(channelId);
    }
    
    // Get user from database to retrieve tokens
    const user = await getUser(channelId);
    if (!user || !user.tokens) {
      console.error(`[EventSub] No user or tokens found for channel ${channelId}`);
      return false;
    }
    
    // Check if token has required scopes
    const requiredScopes = ['channel:read:redemptions', 'channel:manage:redemptions'];
    const hasRequiredScopes = requiredScopes.every(scope => 
      user.tokens?.scope.includes(scope)
    );
    
    if (!hasRequiredScopes) {
      console.error(`[EventSub] User ${channelId} is missing required scopes for channel point redemptions. Please re-authenticate.`);
      console.error(`[EventSub] Current scopes: ${user.tokens.scope.join(', ')}`);
      console.error(`[EventSub] Required scopes: ${requiredScopes.join(', ')}`);
      return false;
    }
    
    debugLog(`User ${channelId} has all required scopes for channel point redemptions`);
    
    // Check if token is expired or about to expire
    const now = new Date();
    const expiresAt = new Date(user.tokens.expiresAt);
    const timeUntilExpiry = Math.floor((expiresAt.getTime() - now.getTime()) / 1000);
    
    if (expiresAt <= now) {
      console.error(`[EventSub] Token for user ${channelId} is expired. Please re-authenticate.`);
      return false;
    }
    
    if (timeUntilExpiry < 3600) { // Less than 1 hour
      console.warn(`[EventSub] Token for user ${channelId} will expire soon (${timeUntilExpiry} seconds). Consider re-authenticating.`);
    }
    
    // Create auth provider with token refresh
    debugLog(`Creating auth provider for channel ${channelId}`);
    const authProvider = new RefreshingAuthProvider({
      clientId: TWITCH_CONFIG.clientId,
      clientSecret: TWITCH_CONFIG.clientSecret,
    });
    
    // Set up token refresh callback
    authProvider.onRefresh(async (userId, newTokenData) => {
      try {
        debugLog(`Refreshing token for user ${userId}`);
        console.log(`[EventSub] Refreshing token for user ${userId}`);
        await updateUserTokens(userId, {
          accessToken: newTokenData.accessToken,
          refreshToken: newTokenData.refreshToken || user.tokens!.refreshToken,
          expiresAt: new Date(Date.now() + (newTokenData.expiresIn || 0) * 1000),
          scope: newTokenData.scope || user.tokens!.scope,
        });
      } catch (error) {
        console.error(`[EventSub] Failed to update tokens for user ${userId}:`, error);
      }
    });
    
    // Add user to auth provider
    debugLog(`Adding user ${channelId} to auth provider`);
    await authProvider.addUser(channelId, {
      accessToken: user.tokens.accessToken,
      refreshToken: user.tokens.refreshToken,
      expiresIn: Math.floor((new Date(user.tokens.expiresAt).getTime() - Date.now()) / 1000),
      obtainmentTimestamp: Date.now(),
      scope: user.tokens.scope
    });
    
    // Create API client
    debugLog(`Creating API client for channel ${channelId}`);
    const apiClient = new ApiClient({ authProvider });
    
    // Check if there are existing subscriptions for this channel
    try {
      debugLog(`Checking for existing subscriptions for channel ${channelId}`);
      console.log(`[EventSub] Checking for existing subscriptions for channel ${channelId}`);
      const subscriptions = await apiClient.eventSub.getSubscriptions();
      
      console.log(`[EventSub] Found ${subscriptions.data.length} subscriptions total`);
      
      // Look for an existing subscription for this channel and reward
      const existingSubscription = subscriptions.data.find(sub => 
        sub.type === 'channel.channel_points_custom_reward_redemption.add' &&
        sub.condition && 
        sub.condition.broadcaster_user_id === channelId
      );
      
      if (existingSubscription) {
        debugLog(`Found existing subscription for channel ${channelId}: ${existingSubscription.id}`);
        console.log(`[EventSub] Found existing subscription for channel ${channelId}: ${existingSubscription.id}`);
        console.log(`[EventSub] Subscription status: ${existingSubscription.status}`);
        
        // If the subscription is active, we can reuse it
        if (existingSubscription.status === 'enabled') {
          debugLog(`Existing subscription is active, updating database record`);
          console.log(`[EventSub] Existing subscription is active, updating database record`);
          
          // Update the database to reflect the active status
          await db.collection('monitorSettings').doc(channelId).set({
            channelId,
            rewardId,
            isActive: true,
            updatedAt: new Date()
          }, { merge: true });
          
          // We'll still create a new listener but won't try to create a new subscription
          debugLog(`Creating EventSub listener for channel ${channelId} without new subscription`);
          console.log(`[EventSub] Creating EventSub listener for channel ${channelId} without new subscription`);
          const listener = new EventSubWsListener({ apiClient });
          console.log('[EventSub] Starting EventSub listener...');
          await listener.start();
          console.log('[EventSub] EventSub listener started successfully');
          
          // Store the listener in our map
          activeListeners.set(channelId, {
            listener,
            subscription: existingSubscription,
            rewardId
          });
          
          // Emit event for real-time updates
          emitEvent({
            type: 'SUBSCRIPTION_CREATED',
            channelId,
            timestamp: new Date(),
            data: {
              rewardId,
              status: 'reused_existing'
            }
          });
          
          return true;
        } else {
          // If the subscription exists but is not enabled, try to delete it
          debugLog(`Existing subscription is not active, attempting to delete it`);
          console.log(`[EventSub] Existing subscription is not active (status: ${existingSubscription.status}), attempting to delete it`);
          try {
            await apiClient.eventSub.deleteSubscription(existingSubscription.id);
            debugLog(`Successfully deleted inactive subscription ${existingSubscription.id}`);
            console.log(`[EventSub] Successfully deleted inactive subscription ${existingSubscription.id}`);
          } catch (deleteError) {
            console.error(`[EventSub] Failed to delete inactive subscription ${existingSubscription.id}:`, deleteError);
            // Continue anyway to try creating a new one
          }
        }
      } else {
        console.log(`[EventSub] No existing subscription found for channel ${channelId}`);
      }
    } catch (subError) {
      console.error(`[EventSub] Error checking existing subscriptions:`, subError);
      // Continue anyway to try creating a new one
    }
    
    // Create EventSub listener
    debugLog(`Creating new EventSub listener for channel ${channelId}`);
    console.log(`[EventSub] Creating new EventSub listener for channel ${channelId}`);
    const listener = new EventSubWsListener({ apiClient });
    console.log('[EventSub] Starting EventSub listener...');
    await listener.start();
    console.log('[EventSub] EventSub listener started successfully');
    
    // Subscribe to channel point redemptions
    console.log(`[EventSub] Subscribing to channel point redemptions for channel ${channelId} and reward ${rewardId}`);
    try {
      debugLog(`Creating subscription for channel ${channelId}`);
      const subscription = await listener.onChannelRedemptionAdd(channelId, async (event) => {
        try {
          debugLog(`Received redemption event:`, {
            channelId: event.broadcasterDisplayName,
            rewardId: event.rewardId,
            rewardTitle: event.rewardTitle,
            userId: event.userId,
            userName: event.userName,
            userDisplayName: event.userDisplayName,
            status: event.status,
          });
          
          console.log(`[EventSub] Received redemption event for channel ${event.broadcasterDisplayName}, reward ${event.rewardTitle} (${event.rewardId}), user ${event.userDisplayName}`);
          
          // Check if this is the reward we're monitoring
          if (event.rewardId !== rewardId) {
            debugLog(`Ignoring redemption for different reward: ${event.rewardTitle} (${event.rewardId})`);
            console.log(`[EventSub] Ignoring redemption for different reward: ${event.rewardTitle} (${event.rewardId})`);
            return;
          }
          
          debugLog(`Processing redemption for monitored reward: ${event.rewardTitle} (${event.rewardId})`);
          console.log(`[EventSub] Processing redemption for monitored reward: ${event.rewardTitle} (${event.rewardId})`);
          
          // Get user settings to determine VIP duration
          const channelUser = await getUser(channelId);
          if (!channelUser || !channelUser.settings) {
            console.error(`No user settings found for channel ${channelId}`);
            return;
          }
          
          const vipDuration = channelUser.settings.vipDuration || 12; // Default to 12 hours
          
          // Calculate expiration date
          const expirationDate = new Date();
          expirationDate.setHours(expirationDate.getHours() + vipDuration);
          
          // Check if user already has VIP status
          const vipSessionsRef = db.collection('vipSessions')
            .where('channelId', '==', channelId)
            .where('userId', '==', event.userId)
            .where('isActive', '==', true);
          
          const vipSessionsSnapshot = await vipSessionsRef.get();
          
          if (!vipSessionsSnapshot.empty) {
            // User already has VIP status, extend it
            const vipSession = vipSessionsSnapshot.docs[0];
            await updateVIPSessionExpiration(vipSession.id, expirationDate);
            
            // Log the extension
            await addAuditLog({
              channelId,
              action: 'VIP_EXTENDED',
              username: event.userDisplayName,
              userId: event.userId,
              details: {
                method: 'channel_points_auto',
                rewardTitle: event.rewardTitle,
                rewardCost: event.rewardCost,
                hours: vipDuration
              }
            });
            
            console.log(`Extended VIP status for ${event.userDisplayName} until ${expirationDate}`);
          } else {
            // Grant new VIP status
            try {
              // Make a direct API call to grant VIP status
              // This is a workaround since the Twurple API doesn't have a direct method for VIPs
              if (!channelUser || !channelUser.tokens) {
                throw new Error('User tokens not found');
              }
              
              const response = await fetch(`https://api.twitch.tv/helix/channels/vips?broadcaster_id=${channelId}&user_id=${event.userId}`, {
                method: 'POST',
                headers: {
                  'Client-ID': TWITCH_CONFIG.clientId,
                  'Authorization': `Bearer ${channelUser.tokens.accessToken}`,
                  'Content-Type': 'application/json'
                }
              });
              
              if (!response.ok) {
                throw new Error(`Failed to grant VIP status: ${response.status} ${response.statusText}`);
              }
              
              // Create VIP session in database
              await createVIPSession({
                channelId,
                userId: event.userId,
                username: event.userDisplayName,
                grantedAt: new Date(),
                expiresAt: expirationDate,
                grantedBy: channelId,
                grantedByUsername: channelUser.username || channelUser.displayName || 'System',
                isActive: true,
                grantMethod: 'channelPoints'
              });
              
              // Log the grant
              await addAuditLog({
                channelId,
                action: 'VIP_GRANTED',
                username: event.userDisplayName,
                userId: event.userId,
                details: {
                  method: 'channel_points_auto',
                  rewardTitle: event.rewardTitle,
                  rewardCost: event.rewardCost,
                  expirationDate: expirationDate.toISOString()
                }
              });
              
              console.log(`Granted VIP status to ${event.userDisplayName} until ${expirationDate}`);
            } catch (error) {
              console.error(`Failed to grant VIP status to ${event.userDisplayName}:`, error);
              
              // Log the failure
              await addAuditLog({
                channelId,
                action: 'VIP_GRANT_FAILED',
                username: event.userDisplayName,
                userId: event.userId,
                details: {
                  method: 'channel_points_auto',
                  rewardTitle: event.rewardTitle,
                  rewardCost: event.rewardCost,
                  error: error instanceof Error ? error.message : String(error)
                }
              });
            }
          }
        } catch (error) {
          console.error('Error processing redemption event:', error);
        }
      });
      
      // Store the listener and subscription
      activeListeners.set(channelId, { 
        listener, 
        subscription,
        rewardId
      });
      
      // Update monitoring status in database
      await db.collection('monitorSettings').doc(channelId).set({
        channelId,
        rewardId,
        isActive: true,
        lastUpdated: new Date()
      });
      
      // Emit event for real-time updates
      emitEvent({
        type: 'SUBSCRIPTION_CREATED',
        channelId,
        timestamp: new Date(),
        data: {
          rewardId,
          status: 'created_new'
        }
      });
      
      console.log(`Successfully started monitoring channel ${channelId} for reward ${rewardId}`);
      return true;
    } catch (error) {
      console.error('Error subscribing to channel point redemptions:', error);
      
      // Emit event for real-time updates
      emitEvent({
        type: 'SUBSCRIPTION_FAILED',
        channelId,
        timestamp: new Date(),
        data: {
          rewardId,
          error: error instanceof Error ? error.message : String(error)
        }
      });
      
      return false;
    }
  } catch (error) {
    console.error(`Failed to start monitoring for channel ${channelId}:`, error);
    return false;
  }
}

/**
 * Stop monitoring channel point redemptions for a specific channel
 */
export async function stopRedemptionMonitoring(channelId: string): Promise<boolean> {
  try {
    const monitorData = activeListeners.get(channelId);
    if (!monitorData) {
      console.log(`[EventSub] No active monitoring found for channel ${channelId}`);
      return true;
    }
    
    // Clean up listener
    const { listener, subscription } = monitorData;
    
    // Remove subscription
    if (subscription) {
      console.log(`[EventSub] Stopping subscription for channel ${channelId}`);
      await subscription.stop();
    }
    
    // Stop listener
    console.log(`[EventSub] Stopping listener for channel ${channelId}`);
    await listener.stop();
    
    // Remove from active listeners
    activeListeners.delete(channelId);
    
    // Update monitoring status in database
    await db.collection('monitorSettings').doc(channelId).set({
      channelId,
      rewardId: monitorData.rewardId,
      isActive: false,
      lastUpdated: new Date()
    });
    
    console.log(`[EventSub] Successfully stopped monitoring channel ${channelId}`);
    return true;
  } catch (error) {
    console.error(`[EventSub] Failed to stop monitoring for channel ${channelId}:`, error);
    return false;
  }
}

/**
 * Get the current monitoring status for a channel
 */
export async function getRedemptionMonitorStatus(channelId: string): Promise<{
  isActive: boolean;
  rewardId: string | null;
} | null> {
  try {
    // Check active listeners first
    if (activeListeners.has(channelId)) {
      const { rewardId } = activeListeners.get(channelId)!;
      return {
        isActive: true,
        rewardId
      };
    }
    
    // Check database
    const monitorDoc = await db.collection('monitorSettings').doc(channelId).get();
    if (monitorDoc.exists) {
      const data = monitorDoc.data();
      return {
        isActive: data?.isActive || false,
        rewardId: data?.rewardId || null
      };
    }
    
    return {
      isActive: false,
      rewardId: null
    };
  } catch (error) {
    console.error(`Failed to get monitoring status for channel ${channelId}:`, error);
    return null;
  }
}

/**
 * Initialize monitoring for all channels that have it enabled
 */
export async function initializeAllMonitoring(): Promise<void> {
  // Add a guard to prevent multiple initializations
  const INITIALIZATION_KEY = 'eventsub_initialization';
  const INITIALIZATION_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  
  try {
    console.log(`[EventSub] Starting initialization of all monitoring`);
    
    // Check if initialization is already in progress
    const initDoc = await db.collection('system').doc(INITIALIZATION_KEY).get();
    const initData = initDoc.data();
    
    if (initData && initData.inProgress) {
      const lastStartTime = initData.startTime?.toDate() || new Date(0);
      const timeSinceStart = Date.now() - lastStartTime.getTime();
      
      // If initialization started recently, skip
      if (timeSinceStart < INITIALIZATION_TIMEOUT) {
        console.log(`[EventSub] Initialization already in progress (started ${Math.round(timeSinceStart / 1000)} seconds ago). Skipping.`);
        return;
      }
      
      console.log(`[EventSub] Previous initialization appears to have stalled (started ${Math.round(timeSinceStart / 1000)} seconds ago). Restarting.`);
    }
    
    // Mark initialization as in progress
    await db.collection('system').doc(INITIALIZATION_KEY).set({
      inProgress: true,
      startTime: new Date(),
      environment: process.env.NODE_ENV || 'unknown'
    });
    
    // Get all active monitoring settings
    const monitorSettingsSnapshot = await db.collection('monitorSettings')
      .where('isActive', '==', true)
      .get();
    
    if (monitorSettingsSnapshot.empty) {
      console.log('[EventSub] No active monitoring settings found');
      return;
    }
    
    console.log(`[EventSub] Found ${monitorSettingsSnapshot.size} active monitoring settings`);
    
    // Initialize monitoring for each channel
    const initPromises = monitorSettingsSnapshot.docs.map(async (doc) => {
      const data = doc.data();
      const { channelId, rewardId } = data;
      
      if (!channelId || !rewardId) {
        console.error(`[EventSub] Invalid monitoring settings for doc ${doc.id}:`, data);
        return;
      }
      
      try {
        // Check if already monitoring
        if (activeListeners.has(channelId)) {
          console.log(`[EventSub] Already monitoring channel ${channelId}, skipping initialization`);
          return;
        }
        
        console.log(`[EventSub] Initializing monitoring for channel ${channelId} and reward ${rewardId}`);
        await startRedemptionMonitoring(channelId, rewardId);
      } catch (error) {
        console.error(`[EventSub] Failed to initialize monitoring for channel ${channelId}:`, error);
      }
    });
    
    await Promise.all(initPromises);
    console.log('[EventSub] Finished initializing all monitoring');
  } catch (error) {
    console.error('[EventSub] Error initializing monitoring:', error);
  } finally {
    // Mark initialization as complete
    await db.collection('system').doc(INITIALIZATION_KEY).set({
      inProgress: false,
      completedAt: new Date(),
      environment: process.env.NODE_ENV || 'unknown'
    }, { merge: true });
  }
}

/**
 * Get the active listeners for debugging purposes
 * Only available in development mode
 */
export function getActiveListeners(): Map<string, { 
  listener: EventSubWsListener, 
  subscription: any,
  rewardId: string 
}> {
  if (process.env.NODE_ENV !== 'development') {
    console.warn('getActiveListeners should only be called in development mode');
    return new Map();
  }
  
  return activeListeners;
} 