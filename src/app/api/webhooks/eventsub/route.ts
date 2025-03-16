import { NextResponse } from 'next/server';
import { createHmac } from 'crypto';

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

/**
 * @deprecated This endpoint is deprecated. A standalone EventSub service now handles Twitch EventSub events.
 * This route only remains to handle webhook verifications for any existing subscriptions.
 */
export async function POST(req: Request) {
  try {
    console.warn("DEPRECATED: EventSub webhook received. Consider using the standalone EventSub service instead.");
    
    const body = await req.text();
    if (!verifyTwitchSignature(req, body)) {
      return new NextResponse('Invalid signature', { status: 401 });
    }

    const messageType = req.headers.get(MESSAGE_TYPE);
    const data = JSON.parse(body);

    // Handle webhook verification
    if (messageType === 'webhook_callback_verification') {
      console.log("Handling webhook verification challenge");
      return new NextResponse(data.challenge, {
        headers: { 'Content-Type': 'text/plain' },
      });
    }

    // Log but don't process events
    console.log(`[DEPRECATED] Received EventSub event of type: ${data.subscription?.type}`);
    console.log("Events are now handled by the standalone EventSub service.");

    return new NextResponse('OK');
  } catch (error) {
    console.error('Error processing EventSub webhook:', error);
    return new NextResponse('Internal server error', { status: 500 });
  }
} 