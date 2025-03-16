import { getActiveRedemptionMonitors, getUserTokens } from '@/lib/db';
import { startMonitoringRedemptions } from '@/services/redemption-monitor';
import { initializeAllMonitoring } from "@/services/eventsub-manager";

// Track initialization to prevent multiple calls
let isInitializing = false;
let isInitialized = false;

/**
 * Initialize server-side services
 * This function should be called when the server starts
 */
export async function initializeServer() {
  if (isInitializing || isInitialized) {
    return;
  }

  try {
    isInitializing = true;
    console.log("[Server] Initializing EventSub monitoring service...");
    await initializeAllMonitoring();
    console.log("[Server] EventSub monitoring service initialized successfully");
    
    // Initialize redemption monitors
    await initializeRedemptionMonitors();
    
    isInitialized = true;
  } catch (error) {
    console.error("[Server] Failed to initialize EventSub monitoring:", error);
    throw error;
  } finally {
    isInitializing = false;
  }
}

/**
 * Initialize all active redemption monitors
 */
async function initializeRedemptionMonitors() {
  try {
    console.log('Initializing redemption monitors...');
    
    // Get all active monitors from the database
    const activeMonitors = await getActiveRedemptionMonitors();
    console.log(`Found ${activeMonitors.length} active redemption monitors`);
    
    // Start each monitor
    for (const monitor of activeMonitors) {
      try {
        // Get user tokens
        const tokens = await getUserTokens(monitor.channelId);
        
        if (!tokens) {
          console.error(`No tokens found for channel ${monitor.channelId}, skipping monitor initialization`);
          continue;
        }
        
        // Start monitoring
        await startMonitoringRedemptions(monitor.channelId, monitor.rewardId, tokens);
        console.log(`Started redemption monitoring for channel ${monitor.channelId}`);
      } catch (error) {
        console.error(`Error initializing monitor for channel ${monitor.channelId}:`, error);
      }
    }
    
    console.log('Redemption monitors initialization complete');
  } catch (error) {
    console.error('Error initializing redemption monitors:', error);
  }
}

// Initialize the server when this module is imported
if (process.env.NODE_ENV === 'production') {
  console.log("[Server] Running in production mode, initializing server...");
  initializeServer().catch((error) => {
    console.error("[Server] Failed to initialize server:", error);
    // In production, we want to exit if initialization fails
    // This will cause the container to restart
    if (process.env.NODE_ENV === 'production') {
      process.exit(1);
    }
  });
} else {
  console.log("[Server] Running in development mode, server will be initialized on first request");
} 