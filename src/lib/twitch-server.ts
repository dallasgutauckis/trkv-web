import { ApiClient } from '@twurple/api';
import { AppTokenAuthProvider } from '@twurple/auth';

// Create auth provider with client credentials
const authProvider = new AppTokenAuthProvider(
  process.env.TWITCH_CLIENT_ID!,
  process.env.TWITCH_CLIENT_SECRET!,
  ['channel:manage:vips', 'channel:read:vips']
);

// Create API client
export const appClient = new ApiClient({ authProvider }); 