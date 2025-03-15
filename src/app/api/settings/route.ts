import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import * as z from 'zod';
import { getUser, updateUserSettings, createUser } from '@/lib/db';
import { authOptions } from '@/lib/auth';

const updateSettingsSchema = z.object({
  channelId: z.string(),
  channelPointRewardId: z.string().optional(),
  vipDuration: z.number().optional(),
  autoRemoveEnabled: z.boolean().optional(),
  notificationsEnabled: z.boolean().optional(),
});

export async function GET(req: Request) {
  try {
    const session = await getServerSession(authOptions);
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

    // Get user settings
    const user = await getUser(channelId);
    if (!user) {
      // Return default settings if user not found
      return NextResponse.json({
        vipDuration: 12 * 60 * 60 * 1000, // 12 hours
        autoRemoveEnabled: true,
        notificationsEnabled: true,
      });
    }

    return NextResponse.json(user.settings);
  } catch (error) {
    console.error('Error in settings GET:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const json = await req.json();
    const body = updateSettingsSchema.parse(json);

    try {
      // Get user
      let user = await getUser(body.channelId);
      
      // Create user if not found
      if (!user) {
        console.log(`User ${body.channelId} not found, creating new user record`);
        user = await createUser({
          twitchId: body.channelId,
          username: session.user?.name || 'unknown',
          email: session.user?.email || '',
          settings: {
            vipDuration: 12 * 60 * 60 * 1000, // 12 hours
            autoRemoveEnabled: true,
            notificationsEnabled: true,
            ...(body.channelPointRewardId !== undefined && { channelPointRewardId: body.channelPointRewardId }),
          }
        });
      }

      // Update settings
      const updatedSettings = {
        ...user.settings,
        ...(body.channelPointRewardId !== undefined && { channelPointRewardId: body.channelPointRewardId }),
        ...(body.vipDuration !== undefined && { vipDuration: body.vipDuration }),
        ...(body.autoRemoveEnabled !== undefined && { autoRemoveEnabled: body.autoRemoveEnabled }),
        ...(body.notificationsEnabled !== undefined && { notificationsEnabled: body.notificationsEnabled }),
      };

      await updateUserSettings(body.channelId, updatedSettings);
      console.log(`Updated settings for user ${body.channelId}:`, updatedSettings);

      return NextResponse.json({ success: true });
    } catch (dbError: any) {
      console.error('Database error in settings POST:', dbError);
      return NextResponse.json(
        { error: 'Database error', message: dbError.message || 'Unknown database error' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Error in settings POST:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
} 