import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';

// This is needed for Next.js Edge Runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Use Server-Sent Events (SSE) instead of WebSockets for better compatibility with Next.js App Router
export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log("SSE connection rejected: No session");
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');

    if (!channelId) {
      console.log("SSE connection rejected: Missing channelId");
      return new NextResponse('Missing channelId', { status: 400 });
    }

    // Set up SSE response headers
    const responseHeaders = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    });

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        // Send initial connection message
        const initialMessage = {
          type: 'connection_established',
          channelId,
          timestamp: new Date().toISOString()
        };
        
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(initialMessage)}\n\n`));
        
        // Keep the connection alive with a ping every 30 seconds
        const pingInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() })}\n\n`));
          } catch (error) {
            console.error('Error sending ping:', error);
            clearInterval(pingInterval);
          }
        }, 30000);
        
        // Register this client for the channel
        const clientId = Date.now().toString();
        console.log(`SSE connection established for channel: ${channelId}, client: ${clientId}`);
        
        // Add to channel clients map
        if (!channelClients.has(channelId)) {
          channelClients.set(channelId, new Map());
        }
        channelClients.get(channelId)?.set(clientId, controller);
        
        // Clean up when the connection is closed
        req.signal.addEventListener('abort', () => {
          console.log(`SSE connection closed for channel: ${channelId}, client: ${clientId}`);
          clearInterval(pingInterval);
          channelClients.get(channelId)?.delete(clientId);
          if (channelClients.get(channelId)?.size === 0) {
            channelClients.delete(channelId);
          }
        });
      }
    });

    return new NextResponse(stream, { headers: responseHeaders });
  } catch (error) {
    console.error('SSE route error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

// Store SSE clients by channel ID
const channelClients = new Map<string, Map<string, ReadableStreamDefaultController>>();

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