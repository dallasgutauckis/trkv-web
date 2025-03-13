export const TWITCH_CONFIG = {
  clientId: process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID!,
  clientSecret: process.env.TWITCH_CLIENT_SECRET!,
  redirectUri: process.env.NEXTAUTH_URL,
  scopes: [
    'channel:manage:vips',
    'channel:read:redemptions',
    'moderator:read:chatters',
    'channel:read:vips',
  ],
} as const;

export const VIP_SESSION_DURATION = 12 * 60 * 60 * 1000; // 12 hours in milliseconds 