import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUser } from '@/lib/db';
import { db } from '@/lib/firebase';

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters
    const url = new URL(request.url);
    const channelId = url.searchParams.get('channelId');
    const limit = parseInt(url.searchParams.get('limit') || '50', 10);
    const action = url.searchParams.get('action');

    if (!channelId) {
      return NextResponse.json({ error: 'Missing channelId parameter' }, { status: 400 });
    }

    // Get user to verify ownership
    const user = await getUser(session.user.id);
    if (!user || user.twitchId !== channelId) {
      return NextResponse.json({ error: 'Unauthorized to access this channel' }, { status: 403 });
    }

    try {
      // Build query
      let query = db.collection('auditLogs')
        .where('channelId', '==', channelId)
        .orderBy('timestamp', 'desc');
      
      // Add action filter if provided
      if (action) {
        query = query.where('action', '==', action);
      }
      
      // Execute query with limit
      const snapshot = await query.limit(limit).get();
      
      // Format results
      const logs = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp.toDate().toISOString()
        };
      });
      
      return NextResponse.json({ logs });
    } catch (error) {
      // Check if it's an index error
      const errorMessage = error instanceof Error ? error.message : String(error);
      const indexUrl = errorMessage.includes('https://console.firebase.google.com') 
        ? errorMessage.match(/https:\/\/console\.firebase\.google\.com[^\s]*/)?.[0] 
        : null;
      
      if (indexUrl) {
        console.warn('Missing Firestore index. Using fallback query method.');
        
        // Fallback to a simpler query without ordering
        const simpleQuery = db.collection('auditLogs')
          .where('channelId', '==', channelId);
        
        const snapshot = await simpleQuery.get();
        
        // Format results and sort in memory
        const logs = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            ...data,
            timestamp: data.timestamp.toDate().toISOString()
          };
        });
        
        // Sort by timestamp descending
        logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
        
        // Limit after sorting
        const limitedLogs = logs.slice(0, limit);
        
        return NextResponse.json({ 
          logs: limitedLogs,
          indexUrl
        });
      }
      
      // If it's not an index error, rethrow
      throw error;
    }
  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'There was an error fetching the audit logs. Please try again later.',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
} 