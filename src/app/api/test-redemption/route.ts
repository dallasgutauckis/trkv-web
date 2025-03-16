import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUser, updateVIPSessionExpiration, createVIPSession } from '@/lib/db';
import { db } from '@/lib/firebase';
import { addAuditLog } from '@/services/eventsub-manager';
import { z } from 'zod';

// Schema for test redemption request
const testRedemptionSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
  username: z.string(),
  rewardId: z.string(),
  rewardTitle: z.string().default('Test Reward'),
  rewardCost: z.number().default(1000)
});

export async function POST(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const result = testRedemptionSchema.safeParse(body);
    
    if (!result.success) {
      return NextResponse.json({ 
        error: 'Invalid request body',
        details: result.error.format()
      }, { status: 400 });
    }
    
    const { channelId, userId, username, rewardId, rewardTitle, rewardCost } = result.data;

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
    
    let action: string;
    
    if (!vipSessionsSnapshot.empty) {
      // User already has VIP status, extend it
      const vipSession = vipSessionsSnapshot.docs[0];
      await updateVIPSessionExpiration(vipSession.id, expirationDate);
      
      // Log the extension using the EventSub manager's addAuditLog
      await addAuditLog({
        channelId,
        action: 'VIP_EXTENDED',
        username,
        userId,
        details: {
          method: 'test_redemption',
          rewardTitle,
          rewardCost,
          hours: vipDuration
        }
      });
      
      action = 'extended';
      console.log(`Extended VIP status for ${username} until ${expirationDate}`);
    } else {
      // Grant new VIP status
      await createVIPSession({
        channelId,
        userId,
        username,
        grantedAt: new Date(),
        expiresAt: expirationDate,
        grantedBy: channelId,
        grantedByUsername: user.username || user.displayName || 'System',
        isActive: true,
        grantMethod: 'other'
      });
      
      // Log the grant using the EventSub manager's addAuditLog
      await addAuditLog({
        channelId,
        action: 'VIP_GRANTED',
        username,
        userId,
        details: {
          method: 'test_redemption',
          rewardTitle,
          rewardCost,
          expirationDate: expirationDate.toISOString()
        }
      });
      
      action = 'granted';
      console.log(`Granted VIP status to ${username} until ${expirationDate}`);
    }
    
    return NextResponse.json({ 
      success: true,
      result: {
        action,
        username,
        userId,
        expirationDate
      }
    });
  } catch (error) {
    console.error('Error processing test redemption:', error);
    
    // If there's an error, try to log it
    try {
      const session = await getServerSession(authOptions);
      if (session?.user) {
        const body = await request.json();
        if (body && body.channelId && body.userId && body.username) {
          await addAuditLog({
            channelId: body.channelId,
            action: 'VIP_GRANT_FAILED',
            username: body.username,
            userId: body.userId,
            details: {
              method: 'test_redemption',
              error: error instanceof Error ? error.message : String(error)
            }
          });
        }
      }
    } catch (logError) {
      console.error('Error logging test redemption failure:', logError);
    }
    
    return NextResponse.json({ 
      error: 'Internal server error',
      message: 'Failed to process test redemption',
      details: process.env.NODE_ENV === 'development' ? String(error) : undefined
    }, { status: 500 });
  }
} 