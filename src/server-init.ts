import { getActiveRedemptionMonitors, getUserTokens } from '@/lib/db';
import { startMonitoringRedemptions } from '@/services/redemption-monitor';
import { initializeAllMonitoring } from "@/services/eventsub-manager";

// Track initialization to prevent multiple calls
let isInitializing = false;

/**
 * Initialize server-side services
 * This function should be called when the server starts
 */
export async function initializeServer() {
  if (isInitializing) {
    return;
  }

  try {
    isInitializing = true;
    console.log("[Server] Initializing EventSub monitoring service...");
    await initializeAllMonitoring();
    console.log("[Server] EventSub monitoring service initialized successfully");
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
initializeServer().catch((error) => {
  console.error("[Server] Failed to initialize server:", error);
  // Don't exit the process, as this might be running in a development environment
  // where we want to show errors but keep the server running
}); 