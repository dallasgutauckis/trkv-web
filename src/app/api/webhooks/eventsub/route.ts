import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';
import { grantVIPStatus } from '@/lib/twitch';
import { createVIPSession, logAuditEvent } from '@/lib/db';

const TWITCH_MESSAGE_ID = 'Twitch-Eventsub-Message-Id';
const TWITCH_MESSAGE_TIMESTAMP = 'Twitch-Eventsub-Message-Timestamp';
const TWITCH_MESSAGE_SIGNATURE = 'Twitch-Eventsub-Message-Signature';
const MESSAGE_TYPE = 'Twitch-Eventsub-Message-Type';

function verifyTwitchSignature(req: Request, body: string) {
  const messageId = req.headers.get(TWITCH_MESSAGE_ID);
  const timestamp = req.headers.get(TWITCH_MESSAGE_TIMESTAMP);
  const signature = req.headers.get(TWITCH_MESSAGE_SIGNATURE);

  if (!messageId || !timestamp || !signature) {
    return false;
  }

  const secret = process.env.EVENTSUB_SECRET;
  if (!secret) {
    console.error('EVENTSUB_SECRET is not configured');
    return false;
  }

  const message = messageId + timestamp + body;
  const hmac = createHmac('sha256', secret)
    .update(message)
    .digest('hex');
  const expectedSignature = `sha256=${hmac}`;

  return signature === expectedSignature;
}

export async function POST(req: Request) {
  try {
    const body = await req.text();
    if (!verifyTwitchSignature(req, body)) {
      return new NextResponse('Invalid signature', { status: 401 });
    }

    const messageType = req.headers.get(MESSAGE_TYPE);
    const data = JSON.parse(body);

    // Handle webhook verification
    if (messageType === 'webhook_callback_verification') {
      return new NextResponse(data.challenge, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Handle channel point redemption
    if (data.subscription.type === 'channel.channel_points_custom_reward_redemption.add') {
      const redemption = data.event;
      const now = new Date();
      const expiresAt = new Date(now.getTime() + 12 * 60 * 60 * 1000); // 12 hours

      // Grant VIP status
      const success = await grantVIPStatus(
        redemption.broadcaster_user_id,
        redemption.user_id
      );

      if (success) {
        // Create VIP session
        const vipSession = await createVIPSession({
          channelId: redemption.broadcaster_user_id,
          userId: redemption.user_id,
          username: redemption.user_login,
          startedAt: now,
          expiresAt,
          isActive: true,
          redeemedWith: 'channel_points',
        });

        // Log audit event
        await logAuditEvent({
          channelId: redemption.broadcaster_user_id,
          action: 'grant_vip',
          targetUserId: redemption.user_id,
          targetUsername: redemption.user_login,
          performedBy: 'system',
          details: {
            redeemedWith: 'channel_points',
            sessionId: vipSession.id,
            redemptionId: redemption.id,
          },
        });
      }
    }

    return new NextResponse('OK');
  } catch (error) {
    console.error('Error processing EventSub webhook:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
} 