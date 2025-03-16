import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { POST, DELETE, GET } from '../route';
import { grantVIPStatus, removeVIPStatus, isUserVIP } from '@/lib/twitch';
import { createVIPSession, deactivateVIPSession, getActiveVIPSessions, logAuditEvent } from '@/lib/db';
import { broadcastToChannel } from '@/lib/sse';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('@/lib/twitch');
jest.mock('@/lib/db');
jest.mock('@/lib/sse');

describe('VIP API', () => {
  const mockSession = {
    user: {
      id: 'test-user-id',
      name: 'Test User',
    },
  };

  const mockVIPSession = {
    id: 'test-session-id',
    channelId: 'test-channel',
    userId: 'test-user',
    username: 'TestUser',
    grantedAt: new Date(),
    expiresAt: new Date(Date.now() + 3600000),
    isActive: true,
    redeemedWith: 'channel_points',
    grantedBy: 'system',
    grantMethod: 'manual',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
  });

  describe('POST /api/vip', () => {
    const mockRequest = new NextRequest('http://localhost/api/vip', {
      method: 'POST',
      body: JSON.stringify({
        userId: 'test-user',
        username: 'TestUser',
        channelId: 'test-channel',
        redeemedWith: 'channel_points',
      }),
    });

    it('grants VIP status successfully', async () => {
      (isUserVIP as jest.Mock).mockResolvedValue(false);
      (grantVIPStatus as jest.Mock).mockResolvedValue(true);
      (createVIPSession as jest.Mock).mockResolvedValue(mockVIPSession);
      (getActiveVIPSessions as jest.Mock).mockResolvedValue([mockVIPSession]);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual(mockVIPSession);
      expect(grantVIPStatus).toHaveBeenCalledWith('test-channel', 'test-user');
      expect(createVIPSession).toHaveBeenCalled();
      expect(logAuditEvent).toHaveBeenCalled();
      expect(broadcastToChannel).toHaveBeenCalledWith('test-channel', {
        type: 'vip_update',
        vips: [mockVIPSession],
      });
    });

    it('returns error if user is already a VIP', async () => {
      (isUserVIP as jest.Mock).mockResolvedValue(true);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'User is already a VIP' });
      expect(grantVIPStatus).not.toHaveBeenCalled();
    });
  });

  describe('DELETE /api/vip', () => {
    const deleteURL = new URL('http://localhost/api/vip');
    deleteURL.searchParams.append('sessionId', 'test-session-id');
    deleteURL.searchParams.append('channelId', 'test-channel');
    deleteURL.searchParams.append('userId', 'test-user');
    const mockRequest = new NextRequest(deleteURL, { method: 'DELETE' });

    it('removes VIP status successfully', async () => {
      (removeVIPStatus as jest.Mock).mockResolvedValue(true);
      (getActiveVIPSessions as jest.Mock).mockResolvedValue([]);

      const response = await DELETE(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
      expect(removeVIPStatus).toHaveBeenCalledWith('test-channel', 'test-user');
      expect(deactivateVIPSession).toHaveBeenCalledWith('test-session-id');
      expect(logAuditEvent).toHaveBeenCalled();
      expect(broadcastToChannel).toHaveBeenCalledWith('test-channel', {
        type: 'vip_update',
        vips: [],
      });
    });

    it('returns error if missing parameters', async () => {
      const badRequest = new NextRequest('http://localhost/api/vip', {
        method: 'DELETE',
      });

      const response = await DELETE(badRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Missing required parameters' });
      expect(removeVIPStatus).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/vip', () => {
    const getURL = new URL('http://localhost/api/vip');
    getURL.searchParams.append('channelId', 'test-channel');
    const mockRequest = new NextRequest(getURL);

    it('returns active VIP sessions', async () => {
      (getActiveVIPSessions as jest.Mock).mockResolvedValue([mockVIPSession]);

      const response = await GET(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual([mockVIPSession]);
      expect(getActiveVIPSessions).toHaveBeenCalledWith('test-channel');
    });

    it('returns error if missing channelId', async () => {
      const badRequest = new NextRequest('http://localhost/api/vip');

      const response = await GET(badRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data).toEqual({ error: 'Missing channelId parameter' });
      expect(getActiveVIPSessions).not.toHaveBeenCalled();
    });
  });
}); 