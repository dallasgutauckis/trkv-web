import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { channelClients, registerClient, removeClient } from '@/lib/sse';

// This is needed for Next.js Edge Runtime
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Use Server-Sent Events (SSE) instead of WebSockets for better compatibility with Next.js App Router
export async function GET(req: Request) {
  try {
    // Check token from query parameter for authentication
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');
    const token = searchParams.get('token');

    if (!channelId) {
      console.log("SSE connection rejected: Missing channelId");
      return new NextResponse('Missing channelId', { status: 400 });
    }

    // Validate token if provided
    let isAuthenticated = false;
    if (token) {
      try {
        // Try to get session using the token
        const session = await getServerSession(authOptions);
        isAuthenticated = !!session;
      } catch (error) {
        console.error("Error validating token:", error);
      }
    } else {
      // Fallback to regular session check
      const session = await getServerSession(authOptions);
      isAuthenticated = !!session;
    }

    if (!isAuthenticated) {
      console.log("SSE connection rejected: No valid session");
      return new NextResponse('Unauthorized', { status: 401 });
    }

    // Set up SSE response headers with CORS
    const responseHeaders = new Headers({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'X-Accel-Buffering': 'no', // Disable buffering for Nginx
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
        
        // Keep the connection alive with a ping every 15 seconds
        const pingInterval = setInterval(() => {
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: 'ping', timestamp: new Date().toISOString() })}\n\n`));
          } catch (error) {
            console.error('Error sending ping:', error);
            clearInterval(pingInterval);
          }
        }, 15000);
        
        // Register this client for the channel
        const clientId = Date.now().toString();
        console.log(`SSE connection established for channel: ${channelId}, client: ${clientId}`);
        
        // Add to channel clients map
        registerClient(channelId, clientId, controller);
        
        // Clean up when the connection is closed
        req.signal.addEventListener('abort', () => {
          console.log(`SSE connection closed for channel: ${channelId}, client: ${clientId}`);
          clearInterval(pingInterval);
          removeClient(channelId, clientId);
        });
      }
    });

    return new NextResponse(stream, { headers: responseHeaders });
  } catch (error) {
    console.error('SSE route error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
}

// Handle OPTIONS requests for CORS preflight
export async function OPTIONS(req: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    },
  });
} 