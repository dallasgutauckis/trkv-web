/**
 * @deprecated This module is deprecated in favor of the standalone EventSub service.
 * 
 * This file is kept for backward compatibility but the actual functionality
 * has been moved to the standalone Python-based EventSub service.
 */

// Log deprecation warning
console.warn('[DEPRECATED] The redemption-monitor service is now handled by the standalone EventSub service.');

/**
 * @deprecated Use the standalone EventSub service instead
 */
export async function startMonitoringRedemptions(
  channelId: string, 
  rewardId: string, 
  tokens: any
): Promise<void> {
  console.warn(`[DEPRECATED] startMonitoringRedemptions called for channel ${channelId}. ` +
    `This is now handled by the standalone EventSub service.`);
  
  // Return without doing anything - the standalone service will handle this
  return;
}

/**
 * @deprecated Use the standalone EventSub service instead
 */
export async function stopMonitoringRedemptions(channelId: string): Promise<void> {
  console.warn(`[DEPRECATED] stopMonitoringRedemptions called for channel ${channelId}. ` +
    `This is now handled by the standalone EventSub service.`);
  
  // Return without doing anything - the standalone service will handle this
  return;
}

/**
 * @deprecated Use the standalone EventSub service instead
 */
export async function refreshAllMonitors(): Promise<void> {
  console.warn(`[DEPRECATED] refreshAllMonitors called. ` +
    `This is now handled by the standalone EventSub service.`);
  
  // Return without doing anything - the standalone service will handle this
  return;
} 