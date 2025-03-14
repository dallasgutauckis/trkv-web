export const TWITCH_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID || '',
  clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
  scopes: [
    'channel:manage:vips',
    'channel:read:redemptions',
    'channel:manage:redemptions',
    'moderator:read:chatters',
    'channel:read:vips'
  ] as string[],
};

export const VIP_SESSION_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds 