import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import * as z from 'zod';
import { createChannelPointReward } from '@/lib/twitch';
import { getChannelPointReward, updateChannelPointReward } from '@/lib/db';
import { createEventSubSubscriptions } from '@/lib/eventsub';

const createRewardSchema = z.object({
  channelId: z.string(),
  title: z.string().min(1).max(45),
  cost: z.number().int().min(1).max(1000000),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
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
    const reward = {
      id: rewardId,
      channelId: body.channelId,
      title: body.title,
      cost: body.cost,
      isEnabled: true,
      autoFulfill: false,
    };

    await updateChannelPointReward(reward);

    // Create EventSub subscriptions
    await createEventSubSubscriptions(body.channelId);

    return NextResponse.json(reward);
  } catch (error) {
    console.error('Error in channel points POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function GET(req: Request) {
  try {
    const session = await getServerSession();
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const channelId = searchParams.get('channelId');

    if (!channelId) {
      return NextResponse.json(
        { error: 'Missing channelId parameter' },
        { status: 400 }
      );
    }

    const reward = await getChannelPointReward(channelId);
    return NextResponse.json(reward || null);
  } catch (error) {
    console.error('Error in channel points GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 