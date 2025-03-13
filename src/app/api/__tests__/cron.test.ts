import { NextResponse } from 'next/server';
import { POST } from '../cron/remove-expired-vips/route';
import { removeVIPStatus } from '@/lib/twitch';
import { getActiveVIPSessions, deactivateVIPSession, logAuditEvent } from '@/lib/db';

// Mock dependencies
jest.mock('@/lib/twitch');
jest.mock('@/lib/db');

describe('Automated VIP Removal Integration', () => {
  const mockVIPSessions = [
    {
      id: 'expired-session-1',
      channelId: 'channel-1',
      userId: 'user-1',
      username: 'User1',
      startedAt: new Date(Date.now() - 13 * 60 * 60 * 1000), // 13 hours ago
      expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      isActive: true,
      redeemedWith: 'channel_points',
    },
    {
      id: 'expired-session-2',
      channelId: 'channel-1',
      userId: 'user-2',
      username: 'User2',
      startedAt: new Date(Date.now() - 13 * 60 * 60 * 1000), // 13 hours ago
      expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      isActive: true,
      redeemedWith: 'manual',
    },
    {
      id: 'active-session',
      channelId: 'channel-2',
      userId: 'user-3',
      username: 'User3',
      startedAt: new Date(),
      expiresAt: new Date(Date.now() + 11 * 60 * 60 * 1000), // 11 hours from now
      isActive: true,
      redeemedWith: 'channel_points',
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (getActiveVIPSessions as jest.Mock).mockResolvedValue(mockVIPSessions);
    (removeVIPStatus as jest.Mock).mockResolvedValue(true);
  });

  describe('Cron Job Execution', () => {
    it('processes expired VIP sessions successfully', async () => {
      const headers = new Headers();
      headers.set('Authorization', `Bearer ${process.env.CRON_SECRET}`);

      const request = new Request('http://localhost/api/cron/remove-expired-vips', {
        method: 'POST',
        headers,
      });

      const response = await POST(request);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        processedChannels: 1, // Only channel-1 had expired sessions
        totalSessions: 2, // Two expired sessions
      });

      // Verify VIP removal calls
      expect(removeVIPStatus).toHaveBeenCalledTimes(2);
      expect(removeVIPStatus).toHaveBeenCalledWith('channel-1', 'user-1');
      expect(removeVIPStatus).toHaveBeenCalledWith('channel-1', 'user-2');

      // Verify session deactivation
      expect(deactivateVIPSession).toHaveBeenCalledTimes(2);
      expect(deactivateVIPSession).toHaveBeenCalledWith('expired-session-1');
      expect(deactivateVIPSession).toHaveBeenCalledWith('expired-session-2');

      // Verify audit logging
      expect(logAuditEvent).toHaveBeenCalledTimes(2);
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'channel-1',
          action: 'remove_vip',
          targetUserId: 'user-1',
          performedBy: 'system',
          details: expect.objectContaining({
            reason: 'expired',
          }),
        })
      );
      expect(logAuditEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          channelId: 'channel-1',
          action: 'remove_vip',
          targetUserId: 'user-2',
          performedBy: 'system',
          details: expect.objectContaining({
            reason: 'expired',
          }),
        })
      );
    });

    it('handles no expired sessions', async () => {
      (getActiveVIPSessions as jest.Mock).mockResolvedValue([mockVIPSessions[2]]); // Only active session

      const headers = new Headers();
      headers.set('Authorization', `Bearer ${process.env.CRON_SECRET}`);

      const request = new Request('http://localhost/api/cron/remove-expired-vips', {
        method: 'POST',
        headers,
      });

      const response = await POST(request);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        processedChannels: 0,
        totalSessions: 0,
      });

      // Verify no actions were taken
      expect(removeVIPStatus).not.toHaveBeenCalled();
      expect(deactivateVIPSession).not.toHaveBeenCalled();
      expect(logAuditEvent).not.toHaveBeenCalled();
    });

    it('handles VIP removal failures', async () => {
      (removeVIPStatus as jest.Mock)
        .mockResolvedValueOnce(false) // First removal fails
        .mockResolvedValueOnce(true); // Second removal succeeds

      const headers = new Headers();
      headers.set('Authorization', `Bearer ${process.env.CRON_SECRET}`);

      const request = new Request('http://localhost/api/cron/remove-expired-vips', {
        method: 'POST',
        headers,
      });

      const response = await POST(request);
      const data = await response.json();

      // Verify response
      expect(response.status).toBe(200);
      expect(data).toEqual({
        success: true,
        processedChannels: 1,
        totalSessions: 2,
      });

      // Verify partial success
      expect(deactivateVIPSession).toHaveBeenCalledTimes(1); // Only one session was successfully deactivated
      expect(logAuditEvent).toHaveBeenCalledTimes(1); // Only one audit log was created
    });

    it('rejects unauthorized requests', async () => {
      const request = new Request('http://localhost/api/cron/remove-expired-vips', {
        method: 'POST',
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
      expect(await response.text()).toBe('Unauthorized');

      // Verify no actions were taken
      expect(getActiveVIPSessions).not.toHaveBeenCalled();
      expect(removeVIPStatus).not.toHaveBeenCalled();
      expect(deactivateVIPSession).not.toHaveBeenCalled();
      expect(logAuditEvent).not.toHaveBeenCalled();
    });
  });
}); 