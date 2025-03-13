import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { POST as grantVIP, DELETE as removeVIP, GET as getVIPs } from '../vip/route';
import { grantVIPStatus, removeVIPStatus, isUserVIP } from '@/lib/twitch';
import { createVIPSession, deactivateVIPSession, getActiveVIPSessions, logAuditEvent } from '@/lib/db';
import { broadcastUpdate } from '../ws/route';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('@/lib/twitch');
jest.mock('@/lib/db');
jest.mock('../ws/route');

describe('VIP Management Integration', () => {
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
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
    isActive: true,
    redeemedWith: 'channel_points',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
  });

  describe('Complete VIP Management Flow', () => {
    it('handles the complete VIP lifecycle', async () => {
      // Mock initial state - user is not a VIP
      (isUserVIP as jest.Mock).mockResolvedValue(false);
      (grantVIPStatus as jest.Mock).mockResolvedValue(true);
      (createVIPSession as jest.Mock).mockResolvedValue(mockVIPSession);
      (getActiveVIPSessions as jest.Mock)
        .mockResolvedValueOnce([mockVIPSession]) // After granting VIP
        .mockResolvedValueOnce([]); // After removing VIP

      // Step 1: Grant VIP status
      const grantRequest = new Request('http://localhost/api/vip', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'test-user',
          username: 'TestUser',
          channelId: 'test-channel',
          redeemedWith: 'channel_points',
        }),
      });

      const grantResponse = await grantVIP(grantRequest);
      const grantData = await grantResponse.json();

      // Verify VIP was granted successfully
      expect(grantResponse.status).toBe(200);
      expect(grantData).toEqual(mockVIPSession);
      expect(grantVIPStatus).toHaveBeenCalledWith('test-channel', 'test-user');
      expect(createVIPSession).toHaveBeenCalled();
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'grant_vip',
          channelId: 'test-channel',
          targetUserId: 'test-user',
        })
      );
      expect(broadcastUpdate).toHaveBeenCalledWith('test-channel', {
        type: 'vip_update',
        vips: [mockVIPSession],
      });

      // Step 2: Verify VIP status is active
      const getRequest = new Request(
        'http://localhost/api/vip?channelId=test-channel',
        { method: 'GET' }
      );

      const getResponse = await getVIPs(getRequest);
      const getData = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(getData).toEqual([mockVIPSession]);

      // Step 3: Remove VIP status
      (removeVIPStatus as jest.Mock).mockResolvedValue(true);

      const removeRequest = new Request(
        'http://localhost/api/vip?sessionId=test-session-id&channelId=test-channel&userId=test-user',
        { method: 'DELETE' }
      );

      const removeResponse = await removeVIP(removeRequest);
      const removeData = await removeResponse.json();

      expect(removeResponse.status).toBe(200);
      expect(removeData).toEqual({ success: true });
      expect(removeVIPStatus).toHaveBeenCalledWith('test-channel', 'test-user');
      expect(deactivateVIPSession).toHaveBeenCalledWith('test-session-id');
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'remove_vip',
          channelId: 'test-channel',
          targetUserId: 'test-user',
        })
      );
      expect(broadcastUpdate).toHaveBeenCalledWith('test-channel', {
        type: 'vip_update',
        vips: [],
      });

      // Step 4: Verify VIP status is removed
      const finalGetResponse = await getVIPs(getRequest);
      const finalGetData = await finalGetResponse.json();

      expect(finalGetResponse.status).toBe(200);
      expect(finalGetData).toEqual([]);
    });

    it('handles errors in the VIP lifecycle', async () => {
      // Mock initial state - user is already a VIP
      (isUserVIP as jest.Mock).mockResolvedValue(true);

      // Step 1: Attempt to grant VIP status to existing VIP
      const grantRequest = new Request('http://localhost/api/vip', {
        method: 'POST',
        body: JSON.stringify({
          userId: 'test-user',
          username: 'TestUser',
          channelId: 'test-channel',
          redeemedWith: 'channel_points',
        }),
      });

      const grantResponse = await grantVIP(grantRequest);
      const grantData = await grantResponse.json();

      expect(grantResponse.status).toBe(400);
      expect(grantData).toEqual({ error: 'User is already a VIP' });
      expect(grantVIPStatus).not.toHaveBeenCalled();
      expect(createVIPSession).not.toHaveBeenCalled();

      // Step 2: Attempt to remove VIP with missing parameters
      const removeRequest = new Request('http://localhost/api/vip', {
        method: 'DELETE',
      });

      const removeResponse = await removeVIP(removeRequest);
      const removeData = await removeResponse.json();

      expect(removeResponse.status).toBe(400);
      expect(removeData).toEqual({ error: 'Missing required parameters' });
      expect(removeVIPStatus).not.toHaveBeenCalled();
      expect(deactivateVIPSession).not.toHaveBeenCalled();

      // Step 3: Attempt to get VIPs without channelId
      const getRequest = new Request('http://localhost/api/vip', {
        method: 'GET',
      });

      const getResponse = await getVIPs(getRequest);
      const getData = await getResponse.json();

      expect(getResponse.status).toBe(400);
      expect(getData).toEqual({ error: 'Missing channelId parameter' });
      expect(getActiveVIPSessions).not.toHaveBeenCalled();
    });
  });
}); 