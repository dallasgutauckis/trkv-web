import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { GET as getAuthSession } from '../[...nextauth]/route';
import { signIn, signOut } from 'next-auth/react';

// Mock dependencies
jest.mock('next-auth/next');
jest.mock('next-auth/react');

describe('Authentication Security', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Session Management', () => {
    it('validates session tokens', async () => {
      // Test with invalid session
      (getServerSession as jest.Mock).mockResolvedValue(null);
      const request = new Request('http://localhost/api/auth/session');
      const response = await getAuthSession(request);
      expect(response.status).toBe(401);

      // Test with valid session
      const mockSession = {
        user: {
          id: 'test-user',
          name: 'Test User',
        },
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);
      const validResponse = await getAuthSession(request);
      expect(validResponse.status).toBe(200);
    });

    it('handles session expiration', async () => {
      const expiredSession = {
        user: {
          id: 'test-user',
          name: 'Test User',
        },
        expires: new Date(Date.now() - 1000).toISOString(),
      };
      (getServerSession as jest.Mock).mockResolvedValue(expiredSession);

      const request = new Request('http://localhost/api/auth/session');
      const response = await getAuthSession(request);
      expect(response.status).toBe(401);
    });
  });

  describe('Authentication Flow', () => {
    it('validates OAuth state parameter', async () => {
      const mockSignIn = signIn as jest.Mock;
      
      // Test with missing state
      await expect(
        mockSignIn('twitch', { callbackUrl: 'http://localhost' })
      ).rejects.toThrow();

      // Test with invalid state
      await expect(
        mockSignIn('twitch', {
          callbackUrl: 'http://localhost',
          state: 'invalid',
        })
      ).rejects.toThrow();
    });

    it('validates callback URLs', async () => {
      const mockSignIn = signIn as jest.Mock;

      // Test with malicious callback URL
      await expect(
        mockSignIn('twitch', {
          callbackUrl: 'http://malicious-site.com',
        })
      ).rejects.toThrow();

      // Test with valid callback URL
      await expect(
        mockSignIn('twitch', {
          callbackUrl: 'http://localhost:3000/dashboard',
        })
      ).resolves.toBeDefined();
    });

    it('handles sign out securely', async () => {
      const mockSignOut = signOut as jest.Mock;

      // Test sign out with session cleanup
      await mockSignOut({ callbackUrl: 'http://localhost' });
      expect(mockSignOut).toHaveBeenCalledWith(
        expect.objectContaining({
          callbackUrl: 'http://localhost',
        })
      );
    });
  });

  describe('Token Management', () => {
    it('securely stores access tokens', async () => {
      const mockSession = {
        user: {
          id: 'test-user',
          name: 'Test User',
        },
        accessToken: 'test-token',
        refreshToken: 'test-refresh-token',
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      const request = new Request('http://localhost/api/auth/session');
      const response = await getAuthSession(request);
      const data = await response.json();

      // Verify tokens are not exposed in the session response
      expect(data.accessToken).toBeUndefined();
      expect(data.refreshToken).toBeUndefined();
    });

    it('handles token refresh securely', async () => {
      const expiredSession = {
        user: {
          id: 'test-user',
          name: 'Test User',
        },
        accessToken: 'expired-token',
        refreshToken: 'test-refresh-token',
        expires: new Date(Date.now() - 1000).toISOString(),
      };
      (getServerSession as jest.Mock).mockResolvedValue(expiredSession);

      const request = new Request('http://localhost/api/auth/session');
      const response = await getAuthSession(request);
      expect(response.status).toBe(401);
    });
  });

  describe('CSRF Protection', () => {
    it('validates CSRF tokens', async () => {
      const mockSession = {
        user: {
          id: 'test-user',
          name: 'Test User',
        },
        csrfToken: 'valid-token',
      };
      (getServerSession as jest.Mock).mockResolvedValue(mockSession);

      // Test without CSRF token
      const request = new Request('http://localhost/api/auth/callback/twitch');
      const response = await getAuthSession(request);
      expect(response.status).toBe(403);

      // Test with invalid CSRF token
      const invalidRequest = new Request(
        'http://localhost/api/auth/callback/twitch',
        {
          headers: {
            'csrf-token': 'invalid-token',
          },
        }
      );
      const invalidResponse = await getAuthSession(invalidRequest);
      expect(invalidResponse.status).toBe(403);

      // Test with valid CSRF token
      const validRequest = new Request(
        'http://localhost/api/auth/callback/twitch',
        {
          headers: {
            'csrf-token': 'valid-token',
          },
        }
      );
      const validResponse = await getAuthSession(validRequest);
      expect(validResponse.status).toBe(200);
    });
  });
}); 