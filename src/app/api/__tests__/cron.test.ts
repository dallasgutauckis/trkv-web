import { NextResponse } from 'next/server';
import { POST } from '../cron/remove-expired-vips/route';
import { removeVIPStatus } from '@/lib/twitch';
import { getActiveVIPSessions, deactivateVIPSession, logAuditEvent } from '@/lib/db';
import { headers } from 'next/headers';

// Mock dependencies
jest.mock('@/lib/twitch');
jest.mock('@/lib/db');
jest.mock('next/headers');

describe('Automated VIP Removal Integration', () => {
  const mockVIPSessions = [
    {
      id: '1',
      channelId: 'test-channel',
      userId: 'test-user',
      username: 'test-user',
      grantedAt: new Date(Date.now() - 13 * 60 * 60 * 1000), // 13 hours ago
      expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      isActive: true,
      grantedBy: 'system',
      grantMethod: 'manual',
    },
    {
      id: '2',
      channelId: 'test-channel',
      userId: 'test-user-2',
      username: 'test-user-2',
      grantedAt: new Date(Date.now() - 13 * 60 * 60 * 1000), // 13 hours ago
      expiresAt: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
      isActive: true,
      grantedBy: 'system',
      grantMethod: 'manual',
    },
    {
      id: '3',
      channelId: 'test-channel',
      userId: 'test-user-3',
      username: 'test-user-3',
      grantedAt: new Date(),
      expiresAt: new Date(Date.now() + 11 * 60 * 60 * 1000), // 11 hours from now
      isActive: true,
      grantedBy: 'system',
      grantMethod: 'manual',
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (getActiveVIPSessions as jest.Mock).mockResolvedValue(mockVIPSessions);
    (removeVIPStatus as jest.Mock).mockResolvedValue(true);
  });

  describe('Cron Job Execution', () => {
    it('processes expired VIP sessions successfully', async () => {
      // Mock the headers function to return authorized headers
      const mockHeadersInstance = new Headers();
      mockHeadersInstance.set('Authorization', `Bearer ${process.env.CRON_SECRET}`);
      (headers as jest.Mock).mockReturnValue(mockHeadersInstance);

      const response = await POST();
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
      
      // Mock the headers function to return authorized headers
      const mockHeadersInstance = new Headers();
      mockHeadersInstance.set('Authorization', `Bearer ${process.env.CRON_SECRET}`);
      (headers as jest.Mock).mockReturnValue(mockHeadersInstance);

      const response = await POST();
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

      // Mock the headers function to return authorized headers
      const mockHeadersInstance = new Headers();
      mockHeadersInstance.set('Authorization', `Bearer ${process.env.CRON_SECRET}`);
      (headers as jest.Mock).mockReturnValue(mockHeadersInstance);

      const response = await POST();
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
      // Mock the headers function to return unauthorized headers
      const mockHeadersInstance = new Headers();
      (headers as jest.Mock).mockReturnValue(mockHeadersInstance);

      const response = await POST();

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