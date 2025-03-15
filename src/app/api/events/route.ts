import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUser } from '@/lib/db';
import { EventSubEvent, subscribeToEvents } from '@/services/eventsub-manager';

// This is a special API route that uses Server-Sent Events (SSE)
// to stream real-time updates to the client
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return new Response('Unauthorized', { status: 401 });
    }

    // Get query parameters
    const url = new URL(request.url);
    const channelId = url.searchParams.get('channelId');

    if (!channelId) {
      return new Response('Missing channelId parameter', { status: 400 });
    }

    // Get user to verify ownership
    const user = await getUser(session.user.id);
    if (!user || user.twitchId !== channelId) {
      return new Response('Unauthorized to access this channel', { status: 403 });
    }

    // Create a new ReadableStream for SSE
    const stream = new ReadableStream({
      start(controller) {
        // Send an initial message to establish the connection
        controller.enqueue(
          `data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date() })}\n\n`
        );

        // Subscribe to events for this channel
        const unsubscribe = subscribeToEvents((event: EventSubEvent) => {
          // Only forward events for this channel
          if (event.channelId === channelId) {
            controller.enqueue(`data: ${JSON.stringify(event)}\n\n`);
          }
        });

        // Handle client disconnect
        request.signal.addEventListener('abort', () => {
          unsubscribe();
          controller.close();
        });
      }
    });

    // Return the stream as an SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive'
      }
    });
  } catch (error) {
    console.error('Error setting up event stream:', error);
    return new Response('Internal Server Error', { status: 500 });
  }
} 