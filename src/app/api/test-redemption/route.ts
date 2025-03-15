import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUser } from '@/lib/db';
import { db } from '@/lib/firebase';

// Create a local audit log function
async function addAuditLog(entry: {
  channelId: string;
  action: string;
  username: string;
  userId: string;
  details?: Record<string, any>;
}): Promise<void> {
  try {
    // Add to audit log collection
    await db.collection('auditLogs').add({
      ...entry,
      timestamp: new Date()
    });
    console.log('Added audit log entry for', entry.action);
  } catch (error) {
    console.error('Error adding audit log entry:', error);
  }
}

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { channelId, rewardId, userId, username, rewardTitle, rewardCost } = body;

    if (!channelId || !rewardId || !userId || !username) {
      return NextResponse.json({ 
        error: 'Missing required parameters',
        required: ['channelId', 'rewardId', 'userId', 'username'],
        received: Object.keys(body)
      }, { status: 400 });
    }

    // Get user to verify ownership
    const user = await getUser(session.user.id);
    if (!user || user.twitchId !== channelId) {
      return NextResponse.json({ error: 'Unauthorized to access this channel' }, { status: 403 });
    }

    // Get user settings to determine VIP duration
    if (!user.settings) {
      return NextResponse.json({ error: 'User settings not found' }, { status: 404 });
    }
    
    const vipDuration = user.settings.vipDuration || 12; // Default to 12 hours
    
    // Calculate expiration date
    const expirationDate = new Date();
    expirationDate.setHours(expirationDate.getHours() + vipDuration);
    
    // Check if user already has VIP status
    const vipSessionsRef = db.collection('vipSessions')
      .where('channelId', '==', channelId)
      .where('userId', '==', userId)
      .where('isActive', '==', true);
    
    const vipSessionsSnapshot = await vipSessionsRef.get();
    
    let result;
    
    if (!vipSessionsSnapshot.empty) {
      // User already has VIP status, extend it
      const vipSession = vipSessionsSnapshot.docs[0];
      
      // Update the expiration date
      await db.collection('vipSessions').doc(vipSession.id).update({
        expiresAt: expirationDate
      });
      
      // Log the extension
      await addAuditLog({
        channelId,
        action: 'VIP_EXTENDED',
        username,
        userId,
        details: {
          method: 'channel_points_test',
          rewardTitle: rewardTitle || 'Test Reward',
          rewardCost: rewardCost || 1000,
          hours: vipDuration
        }
      });
      
      result = {
        action: 'extended',
        userId,
        username,
        expirationDate: expirationDate.toISOString()
      };
    } else {
      // Create new VIP session
      const sessionRef = await db.collection('vipSessions').add({
        channelId,
        userId,
        username,
        grantedAt: new Date(),
        expiresAt: expirationDate,
        grantedBy: channelId,
        grantedByUsername: user.username || user.displayName || 'System',
        isActive: true,
        grantMethod: 'channelPoints'
      });
      
      // Log the grant
      await addAuditLog({
        channelId,
        action: 'VIP_GRANTED',
        username,
        userId,
        details: {
          method: 'channel_points_test',
          rewardTitle: rewardTitle || 'Test Reward',
          rewardCost: rewardCost || 1000,
          expirationDate: expirationDate.toISOString()
        }
      });
      
      result = {
        action: 'granted',
        userId,
        username,
        sessionId: sessionRef.id,
        expirationDate: expirationDate.toISOString()
      };
    }
    
    return NextResponse.json({ 
      success: true,
      result
    });
  } catch (error) {
    console.error('Error in test redemption:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'Failed to process test redemption',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
} 