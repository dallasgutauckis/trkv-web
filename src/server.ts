import { initializeAllMonitoring } from "@/services/eventsub-manager";

// Track initialization state
let isInitialized = false;
let initializationPromise: Promise<void> | null = null;

// Initialize the monitoring service
async function initialize() {
  if (isInitialized || initializationPromise) {
    return initializationPromise;
  }

  initializationPromise = (async () => {
    try {
      console.log("[Server] Starting EventSub monitoring service...");
      await initializeAllMonitoring();
      console.log("[Server] EventSub monitoring service started successfully");
      isInitialized = true;
    } catch (error) {
      console.error("[Server] Failed to start EventSub monitoring:", error);
      // Reset initialization state so it can be retried
      isInitialized = false;
      initializationPromise = null;
      throw error;
    }
  })();

  return initializationPromise;
}

// Start the monitoring service immediately
initialize().catch(error => {
  console.error("[Server] Initial EventSub monitoring start failed:", error);
});

// Export the initialization function for use in API routes
export { initialize as ensureEventSubMonitoring }; 