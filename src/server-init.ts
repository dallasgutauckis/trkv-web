import { getActiveRedemptionMonitors, getUserTokens } from '@/lib/db';
import { startMonitoringRedemptions } from '@/services/redemption-monitor';

/**
 * Initialize server-side services
 * This function should be called when the server starts
 */
export async function initializeServer() {
  console.log('Initializing server-side services...');
  
  try {
    // Start all active redemption monitors
    await initializeRedemptionMonitors();
    
    console.log('Server initialization complete');
  } catch (error) {
    console.error('Error during server initialization:', error);
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