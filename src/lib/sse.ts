// Store SSE clients by channel ID
export const channelClients = new Map<string, Map<string, ReadableStreamDefaultController>>();

// Register a new client for a channel
export function registerClient(channelId: string, clientId: string, controller: ReadableStreamDefaultController) {
  if (!channelClients.has(channelId)) {
    channelClients.set(channelId, new Map());
  }
  channelClients.get(channelId)?.set(clientId, controller);
}

// Remove a client from a channel
export function removeClient(channelId: string, clientId: string) {
  channelClients.get(channelId)?.delete(clientId);
  if (channelClients.get(channelId)?.size === 0) {
    channelClients.delete(channelId);
  }
}

// Function to broadcast updates to all clients for a channel
export function broadcastToChannel(channelId: string, data: any) {
  const clients = channelClients.get(channelId);
  if (!clients || clients.size === 0) {
    console.log(`No active SSE connections for channel ${channelId}`);
    return;
  }
  
  console.log(`Broadcasting to ${clients.size} clients for channel ${channelId}`);
  const encoder = new TextEncoder();
  const message = encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  
  let successCount = 0;
  clients.forEach((controller, clientId) => {
    try {
      controller.enqueue(message);
      successCount++;
    } catch (error) {
      console.error(`Error sending to client ${clientId}:`, error);
      clients.delete(clientId);
    }
  });
  
  console.log(`Successfully sent update to ${successCount}/${clients.size} clients`);
} 