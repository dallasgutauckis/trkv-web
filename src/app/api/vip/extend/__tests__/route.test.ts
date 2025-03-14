import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { POST } from '../route';
import { isUserVIP } from '@/lib/twitch';
import { getActiveVIPSessions, updateVIPSessionExpiration, logAuditEvent } from '@/lib/db';
import { broadcastToChannel } from '@/lib/sse';
import { VIP_SESSION_DURATION } from '@/config/twitch';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('@/lib/twitch');
jest.mock('@/lib/db');
jest.mock('@/lib/sse');

describe('VIP Extend API', () => {
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
    expiresAt: new Date(Date.now() + 3600000), // 1 hour from now
    isActive: true,
    redeemedWith: 'channel_points',
  };

  const mockUpdatedVIPSession = {
    ...mockVIPSession,
    expiresAt: new Date(mockVIPSession.expiresAt.getTime() + VIP_SESSION_DURATION),
  };

  const mockRequest = new Request('http://localhost/api/vip/extend', {
    method: 'POST',
    body: JSON.stringify({
      sessionId: 'test-session-id',
      channelId: 'test-channel',
      userId: 'test-user',
      username: 'TestUser',
    }),
  });

  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue(mockSession);
  });

  it('extends VIP duration successfully', async () => {
    (isUserVIP as jest.Mock).mockResolvedValue(true);
    (getActiveVIPSessions as jest.Mock).mockResolvedValue([mockVIPSession]);
    (updateVIPSessionExpiration as jest.Mock).mockResolvedValue(mockUpdatedVIPSession);
    (getActiveVIPSessions as jest.Mock).mockResolvedValueOnce([mockUpdatedVIPSession]);

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual({
      success: true,
      vipSession: mockUpdatedVIPSession,
    });
    expect(isUserVIP).toHaveBeenCalledWith('test-channel', 'test-user');
    expect(updateVIPSessionExpiration).toHaveBeenCalled();
    expect(logAuditEvent).toHaveBeenCalled();
    expect(broadcastToChannel).toHaveBeenCalledWith('test-channel', {
      type: 'vip_update',
      vips: [mockUpdatedVIPSession],
    });
  });

  it('returns error if user is not a VIP', async () => {
    (isUserVIP as jest.Mock).mockResolvedValue(false);

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data).toEqual({ error: 'User is not a VIP' });
    expect(updateVIPSessionExpiration).not.toHaveBeenCalled();
  });

  it('returns error if VIP session not found', async () => {
    (isUserVIP as jest.Mock).mockResolvedValue(true);
    (getActiveVIPSessions as jest.Mock).mockResolvedValue([]);

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data).toEqual({ error: 'VIP session not found' });
    expect(updateVIPSessionExpiration).not.toHaveBeenCalled();
  });

  it('returns error if session update fails', async () => {
    (isUserVIP as jest.Mock).mockResolvedValue(true);
    (getActiveVIPSessions as jest.Mock).mockResolvedValue([mockVIPSession]);
    (updateVIPSessionExpiration as jest.Mock).mockResolvedValue(null);

    const response = await POST(mockRequest);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data).toEqual({ error: 'Failed to update VIP session' });
    expect(logAuditEvent).not.toHaveBeenCalled();
  });
}); 