import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import * as z from 'zod';
import { createChannelPointReward, getChannelPointRewards } from '@/lib/twitch';
import { getChannelPointReward, updateChannelPointReward } from '@/lib/db';
import { authOptions } from '@/lib/auth';
import { ChannelPointReward } from '@/types/database';
import { randomUUID } from 'crypto';

const createRewardSchema = z.object({
  channelId: z.string(),
  title: z.string().min(1).max(45),
  cost: z.number().int().min(1).max(1000000),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log("No session found in POST /api/channel-points");
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const accessToken = (session as any).accessToken;
    if (!accessToken) {
      console.log("No access token found in session");
      return NextResponse.json(
        { error: 'Missing access token' },
        { status: 401 }
      );
    }

    const json = await req.json();
    const body = createRewardSchema.parse(json);

    // Check if reward already exists
    const existingReward = await getChannelPointReward(body.channelId);
    if (existingReward) {
      return NextResponse.json(
        { error: 'Channel point reward already exists' },
        { status: 400 }
      );
    }

    // Create reward on Twitch
    const rewardId = await createChannelPointReward(
      body.channelId,
      body.title,
      body.cost
    );

    if (!rewardId) {
      return NextResponse.json(
        { error: 'Failed to create channel point reward' },
        { status: 500 }
      );
    }

    // Save reward configuration
    const now = new Date();
    const reward: ChannelPointReward = {
      id: randomUUID(),
      channelId: body.channelId,
      rewardId: rewardId,
      title: body.title,
      cost: body.cost,
      isEnabled: true,
      createdAt: now,
      updatedAt: now,
    };

    await updateChannelPointReward(reward);

    // Note: EventSub subscriptions are now handled by the standalone service
    // The standalone EventSub service will automatically detect new rewards from Firestore
    console.log(`Channel point reward created. The standalone EventSub service will handle subscriptions for channel ${body.channelId}`);

    return NextResponse.json(reward);
  } catch (error) {
    console.error('Error in channel points POST:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    console.log("Handling GET request to /api/channel-points");
    
    const session = await getServerSession(authOptions);
    if (!session) {
      console.log("No session found in GET /api/channel-points");
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const accessToken = (session as any).accessToken;
    if (!accessToken) {
      console.log("No access token found in session");
      return NextResponse.json(
        { error: 'Missing access token' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');

    if (!channelId) {
      console.log("Missing channelId in GET /api/channel-points");
      return NextResponse.json(
        { error: 'Missing channelId parameter' },
        { status: 400 }
      );
    }

    console.log("Fetching channel point rewards for channel:", channelId);
    console.log("Using access token:", accessToken.slice(0, 10) + '...');
    
    try {
      const rewards = await getChannelPointRewards(accessToken, channelId);
      
      // Log the rewards data for debugging
      console.log("Rewards from Twitch API:", JSON.stringify(rewards, null, 2));
      
      if (!rewards) {
        console.log("No rewards returned from Twitch API");
        return NextResponse.json([]);
      }
      
      if (!Array.isArray(rewards)) {
        console.error("Invalid rewards data format:", rewards);
        return NextResponse.json(
          { error: 'Invalid rewards data format' },
          { status: 500 }
        );
      }
      
      // Validate and format each reward
      const formattedRewards = rewards
        .filter(reward => {
          if (!reward || !reward.id || !reward.title) {
            console.warn("Invalid reward object:", reward);
            return false;
          }
          return true;
        })
        .map(reward => ({
          id: reward.id,
          title: reward.title,
          cost: reward.cost,
          isEnabled: reward.isEnabled,
          prompt: reward.prompt,
          backgroundColor: reward.backgroundColor || '#9147ff'
        }));
      
      console.log("Formatted rewards:", JSON.stringify(formattedRewards, null, 2));
      
      return NextResponse.json(formattedRewards);
    } catch (error) {
      console.error("Error fetching rewards from Twitch API:", {
        error: error instanceof Error ? error.message : error,
        channelId,
        hasAccessToken: !!accessToken,
        stack: error instanceof Error ? error.stack : undefined
      });
      
      return NextResponse.json(
        { error: 'Failed to fetch channel point rewards from Twitch' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in channel points GET:', {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined
    });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 