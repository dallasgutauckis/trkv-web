import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUser } from '@/lib/db';

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

    // Verify the user is requesting their own scopes
    if (session.user.id !== userId) {
      return NextResponse.json({ error: 'Unauthorized to access this user\'s scopes' }, { status: 403 });
    }

    // Get user from database
    const user = await getUser(userId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Return user scopes
    return NextResponse.json({ 
      scopes: user.tokens?.scope || [],
      hasTokens: !!user.tokens
    });
  } catch (error) {
    console.error('Error getting user scopes:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'Failed to get user scopes',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
} 