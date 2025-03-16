import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { subscribeToEvents, EventSubEvent } from '@/services/eventsub-manager';
import { ensureEventSubMonitoring } from '@/server';

// This is a special API route that uses Server-Sent Events (SSE)
// to stream real-time updates to the client
export async function GET(request: NextRequest) {
  try {
    // Get user session
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get channel ID from query params
    const channelId = request.nextUrl.searchParams.get('channelId');
    if (!channelId) {
      return new Response('Missing channelId', { status: 400 });
    }

    // Verify user owns this channel
    if (session.user.id !== channelId) {
      return new Response('Unauthorized - not channel owner', { status: 403 });
    }

    // Ensure EventSub monitoring is running
    await ensureEventSubMonitoring();

    // Create event stream
    const stream = new ReadableStream({
      start: async (controller) => {
        console.log(`[SSE] Connection established for channel ${channelId}`);
        
        // Send an initial message to establish the connection
        const initialEvent = { 
          type: 'CONNECTED', 
          channelId,
          timestamp: new Date(),
          data: { message: 'Connection established' }
        };
        
        controller.enqueue(
          `data: ${JSON.stringify(initialEvent)}\n\n`
        );

        // Subscribe to events for this channel
        const unsubscribe = subscribeToEvents((event: EventSubEvent) => {
          // Only forward events for this channel
          if (event.channelId === channelId) {
            console.log(`[SSE] Sending event to client: ${event.type}`, event);
            controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
          }
        });

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          console.log(`[SSE] Client disconnected for channel ${channelId}`);
          unsubscribe();
          controller.close();
        });
      }
    });

    // Return the stream as an SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache, no-transform',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no' // Disable buffering for Nginx
      }
    });
  } catch (error) {
    console.error('Error setting up event stream:', error, (error as Error).stack);
    return new Response('Internal Server Error', { status: 500 });
  }
} 