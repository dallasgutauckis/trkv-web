import { NextResponse, NextRequest } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { POST as grantVIP, DELETE as removeVIP, GET as getVIPs } from '../vip/route';
import { grantVIPStatus, removeVIPStatus, isUserVIP } from '@/lib/twitch';
import { createVIPSession, deactivateVIPSession, getActiveVIPSessions, logAuditEvent, updateVIPSessionExpiration } from '@/lib/db';
import { broadcastToChannel } from '@/lib/sse';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('@/lib/twitch');
jest.mock('@/lib/db');
jest.mock('@/lib/sse');

// Mock the POST function for the extend endpoint
const mockExtendPOST = jest.fn();
jest.mock('../vip/extend/route', () => ({
  POST: jest.fn().mockImplementation((...args) => mockExtendPOST(...args))
}));

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
    grantedAt: new Date(),
    expiresAt: new Date(Date.now() + 12 * 60 * 60 * 1000), // 12 hours
    isActive: true,
    redeemedWith: 'channel_points',
    grantedBy: 'system',
    grantMethod: 'manual',
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
      const grantRequestBody = {
        userId: 'test-user',
        username: 'TestUser',
        channelId: 'test-channel',
        redeemedWith: 'channel_points',
      };
      
      const grantRequest = new NextRequest('http://localhost/api/vip', {
        method: 'POST',
        body: JSON.stringify(grantRequestBody),
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
      expect(broadcastToChannel).toHaveBeenCalledWith('test-channel', {
        type: 'vip_update',
        vips: [mockVIPSession],
      });

      // Step 2: Extend VIP duration
      const extendedSession = {
        ...mockVIPSession,
        expiresAt: new Date(mockVIPSession.expiresAt.getTime() + 12 * 60 * 60 * 1000),
      };
      
      (isUserVIP as jest.Mock).mockResolvedValue(true);
      (updateVIPSessionExpiration as jest.Mock).mockResolvedValue(extendedSession);
      (getActiveVIPSessions as jest.Mock)
        .mockResolvedValueOnce([mockVIPSession]) // For finding the session
        .mockResolvedValueOnce([extendedSession]); // After extending

      const extendRequestBody = {
        sessionId: 'test-session-id',
        channelId: 'test-channel',
        userId: 'test-user',
        username: 'TestUser',
      };
      
      const extendRequest = new NextRequest('http://localhost/api/vip/extend', {
        method: 'POST',
        body: JSON.stringify(extendRequestBody),
      });

      mockExtendPOST.mockResolvedValue(
        NextResponse.json({
          success: true,
          vipSession: extendedSession,
        })
      );

      const extendResponse = await mockExtendPOST(extendRequest);
      const extendData = await extendResponse.json();

      // Verify VIP was extended successfully
      expect(extendResponse.status).toBe(200);
      expect(extendData).toEqual({
        success: true,
        vipSession: extendedSession,
      });
      expect(updateVIPSessionExpiration).toHaveBeenCalled();
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'grant_vip',
          channelId: 'test-channel',
          targetUserId: 'test-user',
          details: expect.objectContaining({
            action: 'extend',
          }),
        })
      );
      expect(broadcastToChannel).toHaveBeenCalledWith('test-channel', {
        type: 'vip_update',
        vips: [extendedSession],
      });

      // Step 3: Get VIPs
      const getURL = new URL('http://localhost/api/vip');
      getURL.searchParams.append('channelId', 'test-channel');
      const getRequest = new NextRequest(getURL);

      (getActiveVIPSessions as jest.Mock).mockResolvedValueOnce([mockVIPSession]);

      const getResponse = await getVIPs(getRequest);
      const getData = await getResponse.json();

      expect(getResponse.status).toBe(200);
      expect(getData).toEqual([mockVIPSession]);

      // Step 4: Remove VIP status
      (removeVIPStatus as jest.Mock).mockResolvedValue(true);

      const removeURL = new URL('http://localhost/api/vip');
      removeURL.searchParams.append('sessionId', 'test-session-id');
      removeURL.searchParams.append('channelId', 'test-channel');
      removeURL.searchParams.append('userId', 'test-user');
      const removeRequest = new NextRequest(removeURL, { method: 'DELETE' });

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
      expect(broadcastToChannel).toHaveBeenCalledWith('test-channel', {
        type: 'vip_update',
        vips: [],
      });

      // Step 5: Verify VIP status is removed
      const finalGetResponse = await getVIPs(getRequest);
      const finalGetData = await finalGetResponse.json();

      expect(finalGetResponse.status).toBe(200);
      expect(finalGetData).toEqual([]);
    });

    it('handles errors in the VIP lifecycle', async () => {
      // Mock initial state - user is already a VIP
      (isUserVIP as jest.Mock).mockResolvedValue(true);

      // Step 1: Attempt to grant VIP status to existing VIP
      const grantRequestBody = {
        userId: 'test-user',
        username: 'TestUser',
        channelId: 'test-channel',
        redeemedWith: 'channel_points',
      };
      
      const grantRequest = new NextRequest('http://localhost/api/vip', {
        method: 'POST',
        body: JSON.stringify(grantRequestBody),
      });

      const grantResponse = await grantVIP(grantRequest);
      const grantData = await grantResponse.json();

      expect(grantResponse.status).toBe(400);
      expect(grantData).toEqual({ error: 'User is already a VIP' });
      expect(grantVIPStatus).not.toHaveBeenCalled();
      expect(createVIPSession).not.toHaveBeenCalled();

      // Step 2: Attempt to remove VIP with missing parameters
      const removeRequest = new NextRequest('http://localhost/api/vip', {
        method: 'DELETE',
      });

      const removeResponse = await removeVIP(removeRequest);
      const removeData = await removeResponse.json();

      expect(removeResponse.status).toBe(400);
      expect(removeData).toEqual({ error: 'Missing required parameters' });
      expect(removeVIPStatus).not.toHaveBeenCalled();
      expect(deactivateVIPSession).not.toHaveBeenCalled();

      // Step 3: Attempt to get VIPs without channelId
      const getRequest = new NextRequest('http://localhost/api/vip');

      const getResponse = await getVIPs(getRequest);
      const getData = await getResponse.json();

      expect(getResponse.status).toBe(400);
      expect(getData).toEqual({ error: 'Missing channelId parameter' });
      expect(getActiveVIPSessions).not.toHaveBeenCalled();
    });
  });
}); 