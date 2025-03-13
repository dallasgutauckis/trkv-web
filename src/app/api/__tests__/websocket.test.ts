import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { GET } from '../ws/route';
import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { createServer } from 'http';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('ws');

describe('WebSocket Integration', () => {
  const mockSession = {
    user: {
      id: 'test-user-id',
      name: 'Test User',
    },
  };

  let mockServer: Server;
  let mockWss: jest.Mocked<WebSocketServer>;
  let mockWs: jest.Mocked<WebSocket>;

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);

    // Create mock HTTP server
    mockServer = createServer();

    // Create mock WebSocket server
    mockWss = new WebSocketServer({ server: mockServer }) as jest.Mocked<WebSocketServer>;
    mockWs = new WebSocket('') as jest.Mocked<WebSocket>;

    // Mock WebSocket server methods
    mockWss.on = jest.fn().mockImplementation((event, callback) => {
      if (event === 'connection') {
        callback(mockWs, { url: 'ws://localhost/api/ws?channelId=test-channel' });
      }
    });

    // Mock WebSocket client methods
    mockWs.on = jest.fn();
    mockWs.send = jest.fn();
    mockWs.close = jest.fn();
  });

  afterEach(() => {
    mockServer.close();
  });

  describe('WebSocket Connection', () => {
    it('establishes connection successfully', async () => {
      const headers = new Headers();
      headers.set('upgrade', 'websocket');

      const request = new Request('http://localhost/api/ws?channelId=test-channel', {
        headers,
      });
      (request as any).socket = { server: mockServer };

      const response = await GET(request);

      expect(response.status).toBe(101);
      expect(mockWss.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });

    it('rejects connection without channelId', async () => {
      const headers = new Headers();
      headers.set('upgrade', 'websocket');

      const request = new Request('http://localhost/api/ws', {
        headers,
      });
      (request as any).socket = { server: mockServer };

      const response = await GET(request);

      expect(response.status).toBe(400);
      expect(await response.text()).toBe('Missing channelId');
    });

    it('rejects non-WebSocket requests', async () => {
      const request = new Request('http://localhost/api/ws?channelId=test-channel');
      (request as any).socket = { server: mockServer };

      const response = await GET(request);

      expect(response.status).toBe(426);
      expect(await response.text()).toBe('Expected Upgrade: websocket');
    });

    it('rejects unauthenticated requests', async () => {
      (getServerSession as jest.Mock).mockResolvedValue(null);

      const headers = new Headers();
      headers.set('upgrade', 'websocket');

      const request = new Request('http://localhost/api/ws?channelId=test-channel', {
        headers,
      });
      (request as any).socket = { server: mockServer };

      const response = await GET(request);

      expect(response.status).toBe(401);
      expect(await response.text()).toBe('Unauthorized');
    });
  });

  describe('WebSocket Communication', () => {
    it('handles client disconnection', async () => {
      const headers = new Headers();
      headers.set('upgrade', 'websocket');

      const request = new Request('http://localhost/api/ws?channelId=test-channel', {
        headers,
      });
      (request as any).socket = { server: mockServer };

      await GET(request);

      // Simulate client connection
      const connectionCallback = (mockWss.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      connectionCallback(mockWs, { url: 'ws://localhost/api/ws?channelId=test-channel' });

      // Verify close handler was set up
      expect(mockWs.on).toHaveBeenCalledWith('close', expect.any(Function));

      // Simulate client disconnection
      const closeCallback = (mockWs.on as jest.Mock).mock.calls.find(
        call => call[0] === 'close'
      )[1];
      closeCallback();

      // Verify cleanup
      expect(mockWs.close).toHaveBeenCalled();
    });

    it('broadcasts updates to connected clients', async () => {
      const headers = new Headers();
      headers.set('upgrade', 'websocket');

      const request = new Request('http://localhost/api/ws?channelId=test-channel', {
        headers,
      });
      (request as any).socket = { server: mockServer };

      await GET(request);

      // Simulate client connection
      const connectionCallback = (mockWss.on as jest.Mock).mock.calls.find(
        call => call[0] === 'connection'
      )[1];
      connectionCallback(mockWs, { url: 'ws://localhost/api/ws?channelId=test-channel' });

      // Mock WebSocket ready state
      Object.defineProperty(mockWs, 'readyState', {
        value: WebSocket.OPEN,
        writable: true,
      });

      // Simulate broadcast
      const updateData = {
        type: 'vip_update',
        vips: [{ id: 'test-vip' }],
      };

      // Import and call broadcastUpdate
      const { broadcastUpdate } = require('../ws/route');
      broadcastUpdate('test-channel', updateData);

      // Verify message was sent
      expect(mockWs.send).toHaveBeenCalledWith(JSON.stringify(updateData));
    });
  });
}); 