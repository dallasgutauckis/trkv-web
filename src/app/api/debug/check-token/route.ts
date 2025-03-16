import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUser } from '@/lib/db';
import { TWITCH_CONFIG } from '@/config/twitch';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'Missing userId parameter' }, { status: 400 });
    }

    // Get user to verify ownership
    const user = await getUser(session.user.id);
    if (!user || user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized to access this user' }, { status: 403 });
    }

    // Check if user has tokens
    if (!user.tokens) {
      return NextResponse.json({ 
        isValid: false,
        error: 'No tokens found for this user'
      });
    }

    // Check if token is expired
    const now = new Date();
    const expiresAt = new Date(user.tokens.expiresAt);
    
    if (expiresAt <= now) {
      return NextResponse.json({ 
        isValid: false,
        error: 'Token is expired',
        expiresAt: expiresAt.toISOString(),
        now: now.toISOString()
      });
    }

    // Validate token with Twitch
    try {
      const response = await fetch('https://id.twitch.tv/oauth2/validate', {
        headers: {
          'Authorization': `OAuth ${user.tokens.accessToken}`
        }
      });
      
      if (!response.ok) {
        return NextResponse.json({ 
          isValid: false,
          error: `Token validation failed: ${response.status} ${response.statusText}`
        });
      }
      
      const data = await response.json();
      
      return NextResponse.json({
        isValid: true,
        clientId: data.client_id,
        userId: data.user_id,
        username: data.login,
        scopes: data.scopes,
        expiresIn: data.expires_in,
        tokenDetails: {
          expiresAt: expiresAt.toISOString(),
          timeUntilExpiry: Math.floor((expiresAt.getTime() - now.getTime()) / 1000),
          scope: user.tokens.scope
        }
      });
    } catch (error) {
      console.error('Error validating token:', error);
      return NextResponse.json({ 
        isValid: false,
        error: error instanceof Error ? error.message : 'Unknown error validating token'
      });
    }
  } catch (error) {
    console.error('Error checking token:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'Failed to check token',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
} 