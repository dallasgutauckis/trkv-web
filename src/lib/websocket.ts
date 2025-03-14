import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { IncomingMessage } from 'http';

// Extend the Server type to include our wss property
declare module 'http' {
  interface Server {
    wss?: WebSocketServer;
  }
}

let wss: WebSocketServer | null = null;

// Store WebSocket connections by channel ID
const channelConnections = new Map<string, Set<WebSocket>>();

// Initialize WebSocket server
export function initWebSocketServer(server: Server) {
  // If we already have a WebSocket server attached to this HTTP server, return it
  if (server.wss) {
    return server.wss;
  }

  // Create a new WebSocket server if one doesn't exist
  if (!wss) {
    console.log('Initializing WebSocket server');
    try {
      wss = new WebSocketServer({ server });

      // Store the WebSocket server on the HTTP server instance for reuse
      server.wss = wss;

      wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
        console.log('New WebSocket connection established');
        try {
          const url = new URL(req.url || '', `http://${req.headers.host || 'localhost'}`);
          const channelId = url.searchParams.get('channelId');
          const token = url.searchParams.get('token');

          if (!channelId) {
            console.log('WebSocket connection rejected: Missing channelId');
            ws.close(1008, 'Missing channelId');
            return;
          }

          console.log(`WebSocket connected for channel: ${channelId}`);

          // Add connection to channel's set
          let connections = channelConnections.get(channelId);
          if (!connections) {
            connections = new Set();
            channelConnections.set(channelId, connections);
          }
          connections.add(ws);

          // Send initial connection confirmation
          ws.send(JSON.stringify({ 
            type: 'connection_established',
            channelId,
            timestamp: new Date().toISOString()
          }));

          // Handle client disconnect
          ws.on('close', (code, reason) => {
            console.log(`WebSocket disconnected for channel ${channelId}`);
            const connections = channelConnections.get(channelId);
            if (connections) {
              connections.delete(ws);
              if (connections.size === 0) {
                channelConnections.delete(channelId);
              }
            }
          });

          // Handle errors
          ws.on('error', (error) => {
            console.error(`WebSocket error for channel ${channelId}:`, error);
          });
        } catch (error) {
          console.error('Error handling WebSocket connection:', error);
          ws.close(1011, 'Internal server error');
        }
      });

      wss.on('error', (error) => {
        console.error('WebSocket server error:', error);
      });
    } catch (error) {
      console.error('Failed to initialize WebSocket server:', error);
      throw error;
    }
  }
  
  return wss;
}

// Broadcast update to all connected clients for a channel
export function broadcastUpdate(channelId: string, data: any) {
  const connections = channelConnections.get(channelId);
  if (connections && connections.size > 0) {
    const message = JSON.stringify(data);
    console.log(`Broadcasting update to ${connections.size} clients for channel ${channelId}`);
    
    let successCount = 0;
    connections.forEach(ws => {
      try {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(message);
          successCount++;
        }
      } catch (error) {
        console.error(`Error sending message to client for channel ${channelId}:`, error);
      }
    });
    
    console.log(`Successfully sent update to ${successCount}/${connections.size} clients`);
  } else {
    console.log(`No active connections for channel ${channelId}`);
  }
} 