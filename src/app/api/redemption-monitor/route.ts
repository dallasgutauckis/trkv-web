import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUser } from '@/lib/db';
import { db } from '@/lib/firebase';
import * as z from 'zod';

// Define constants for service status
const COLLECTION_MONITORING = 'channelPointMonitoring';
const COLLECTION_SERVICE_STATUS = 'serviceStatus';
const SERVICE_DOC_ID = 'eventsub-service';

/**
 * This endpoint now integrates with the standalone EventSub service
 * instead of using the local implementation.
 * 
 * The standalone service automatically detects settings from Firestore,
 * so we just need to update the database.
 */

// Definition for update request
interface UpdateRequest {
  channelId: string;
  isEnabled: boolean;
  rewardId: string;
}

/**
 * Get the status of the reward monitoring for a channel
 */
export async function GET(req: Request) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Get channelId from query params
    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');
    
    if (!channelId) {
      return NextResponse.json({ error: 'Missing channelId parameter' }, { status: 400 });
    }
    
    // Get monitoring status from Firestore
    const monitoringRef = db.collection(COLLECTION_MONITORING).doc(channelId);
    const monitoringDoc = await monitoringRef.get();
    
    // Get service status from Firestore
    const serviceRef = db.collection(COLLECTION_SERVICE_STATUS).doc(SERVICE_DOC_ID);
    const serviceDoc = await serviceRef.get();
    
    // Prepare service status information
    const serviceStatus = serviceDoc.exists 
      ? {
          isOnline: serviceDoc.data()?.isOnline || false,
          lastSeen: serviceDoc.data()?.lastSeen?.toDate() || null,
          sessionId: serviceDoc.data()?.sessionId || null
        }
      : {
          isOnline: false,
          lastSeen: null,
          sessionId: null
        };
    
    // Return monitoring status and service status
    return NextResponse.json({
      isEnabled: monitoringDoc.exists ? monitoringDoc.data()?.isEnabled || false : false,
      rewardId: monitoringDoc.exists ? monitoringDoc.data()?.rewardId || null : null,
      serviceStatus
    });
    
  } catch (error) {
    console.error('Error fetching monitoring status:', error);
    return NextResponse.json({ error: 'Failed to fetch monitoring status' }, { status: 500 });
  }
}

/**
 * Update the reward monitoring status for a channel
 */
export async function POST(req: Request) {
  try {
    // Authenticate user
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Parse request body
    let body: UpdateRequest;
    try {
      const json = await req.json();
      body = {
        channelId: json.channelId,
        isEnabled: json.isEnabled,
        rewardId: json.rewardId
      };
      
      // Validate required fields
      if (!body.channelId) throw new Error('Missing channelId');
      if (typeof body.isEnabled !== 'boolean') throw new Error('isEnabled must be a boolean');
      if (body.isEnabled && !body.rewardId) throw new Error('rewardId is required when enabling monitoring');
    } catch (error) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }
    
    // Get service status to check if it's online
    const serviceRef = db.collection(COLLECTION_SERVICE_STATUS).doc(SERVICE_DOC_ID);
    const serviceDoc = await serviceRef.get();
    const serviceStatus = serviceDoc.exists 
      ? {
          isOnline: serviceDoc.data()?.isOnline || false,
          lastSeen: serviceDoc.data()?.lastSeen?.toDate() || null,
          sessionId: serviceDoc.data()?.sessionId || null
        }
      : {
          isOnline: false,
          lastSeen: null,
          sessionId: null
        };
    
    // If trying to enable monitoring but service is offline, return error
    if (body.isEnabled && !serviceStatus.isOnline) {
      return NextResponse.json({ 
        error: 'Cannot enable monitoring while service is offline',
        serviceStatus
      }, { status: 503 });
    }
    
    // Update monitoring status in Firestore
    const monitoringRef = db.collection(COLLECTION_MONITORING).doc(body.channelId);
    
    await monitoringRef.set({
      isEnabled: body.isEnabled,
      rewardId: body.rewardId,
      updatedAt: new Date()
    }, { merge: true });
    
    // Log the action
    console.log(`Channel ${body.channelId} ${body.isEnabled ? 'enabled' : 'disabled'} monitoring for reward ${body.rewardId}`);
    
    // Return success with service status
    return NextResponse.json({ 
      success: true, 
      isEnabled: body.isEnabled,
      serviceStatus
    });
    
  } catch (error) {
    console.error('Error updating monitoring status:', error);
    return NextResponse.json({ error: 'Failed to update monitoring status' }, { status: 500 });
  }
} 