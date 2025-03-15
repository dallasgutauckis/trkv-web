export const TWITCH_CONFIG = {
  clientId: process.env.TWITCH_CLIENT_ID || process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID || '',
  clientSecret: process.env.TWITCH_CLIENT_SECRET || '',
  scopes: [
    'user:read:email',
    'channel:read:vips',
    'channel:manage:vips',
    'moderator:read:followers',
    'channel:read:redemptions',
    'channel:manage:redemptions',
    'moderator:manage:announcements',
    'channel:manage:moderators'
  ],
};

export const VIP_SESSION_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds 