import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { IncomingMessage } from 'http';

let wss: WebSocketServer;

// Store WebSocket connections by channel ID
const channelConnections = new Map<string, Set<WebSocket>>();

// Initialize WebSocket server
export function initWebSocketServer(server: Server) {
  if (!wss) {
    wss = new WebSocketServer({ server });

    wss.on('connection', async (ws: WebSocket, req: IncomingMessage) => {
      const url = new URL(req.url || '', 'http://localhost');
      const channelId = url.searchParams.get('channelId');

      if (!channelId) {
        ws.close(1008, 'Missing channelId');
        return;
      }

      // Add connection to channel's set
      let connections = channelConnections.get(channelId);
      if (!connections) {
        connections = new Set();
        channelConnections.set(channelId, connections);
      }
      connections.add(ws);

      // Handle client disconnect
      ws.on('close', () => {
        const connections = channelConnections.get(channelId);
        if (connections) {
          connections.delete(ws);
          if (connections.size === 0) {
            channelConnections.delete(channelId);
          }
        }
      });
    });
  }
  return wss;
}

// Broadcast update to all connected clients for a channel
export function broadcastUpdate(channelId: string, data: any) {
  const connections = channelConnections.get(channelId);
  if (connections) {
    const message = JSON.stringify(data);
    connections.forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(message);
      }
    });
  }
} 