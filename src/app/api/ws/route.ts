import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { getServerSession } from 'next-auth/next';
import { initWebSocketServer } from '@/lib/websocket';

export async function GET(req: Request) {
  const session = await getServerSession();
  if (!session) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const channelId = searchParams.get('channelId');

  if (!channelId) {
    return new NextResponse('Missing channelId', { status: 400 });
  }

  const headersList = headers();
  const upgradeHeader = headersList.get('upgrade') || '';
  if (!upgradeHeader || upgradeHeader.toLowerCase() !== 'websocket') {
    return new NextResponse('Expected Upgrade: websocket', { status: 426 });
  }

  try {
    // Initialize WebSocket server if not already done
    const server = (req as any).socket.server;
    initWebSocketServer(server);

    // Return empty response to allow WebSocket upgrade
    return new NextResponse(null, { status: 101 });
  } catch (error) {
    console.error('WebSocket setup error:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
} 