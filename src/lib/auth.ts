import { NextAuthOptions } from "next-auth";
import { TWITCH_CONFIG } from "@/config/twitch";
import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers/oauth";
import { updateUserTokens } from '@/lib/db';

// Helper function to log to Cloud Run logs
const logToCloudRun = async (message: string, data?: any) => {
  const logEntry = {
    severity: "INFO",
    message,
    ...data && { data },
    timestamp: new Date().toISOString(),
    component: "NextAuth",
    environment: process.env.NODE_ENV,
    auth_url: process.env.NEXTAUTH_URL
  };
  
  try {
    // In development, just console.log
    if (process.env.NODE_ENV === 'development') {
      console.log(JSON.stringify(logEntry, null, 2));
      return;
    }

    // In production, send to monitoring endpoint
    const baseUrl = process.env.NEXTAUTH_URL;
    await fetch(`${baseUrl}/api/monitoring`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(logEntry)
    });
  } catch (error) {
    console.error('Failed to log:', error);
  }
};

if (!process.env.NEXTAUTH_SECRET && process.env.NODE_ENV === 'production') {
  console.error('NEXTAUTH_SECRET is not set in production environment. Using a generated secret instead, but this is not recommended for production.');
}

// Custom Twitch provider that doesn't use OpenID Connect
function CustomTwitchProvider(options: OAuthUserConfig<any>): OAuthConfig<any> {
  return {
    id: "twitch",
    name: "Twitch",
    type: "oauth",
    clientId: options.clientId,
    clientSecret: options.clientSecret,
    authorization: {
      url: "https://id.twitch.tv/oauth2/authorize",
      params: {
        scope: TWITCH_CONFIG.scopes.join(" "),
        response_type: "code",
        force_verify: "true" // Force re-authentication to ensure we get all scopes
      }
    },
    token: {
      url: "https://id.twitch.tv/oauth2/token",
      async request(context) {
        const { params, provider } = context;
        console.log("Token request params:", JSON.stringify({
          ...params,
          code: params.code ? `${params.code.substring(0, 10)}...` : undefined
        }));
        
        // Get the callback URL from the provider
        const baseUrl = process.env.NEXTAUTH_URL || "http://localhost:3000";
        const callbackUrl = provider?.callbackUrl || `${baseUrl}/api/auth/callback/twitch`;
        console.log("Using callback URL:", callbackUrl);
        
        try {
          const response = await fetch("https://id.twitch.tv/oauth2/token", {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              client_id: TWITCH_CONFIG.clientId,
              client_secret: TWITCH_CONFIG.clientSecret,
              grant_type: "authorization_code",
              code: params.code || "",
              redirect_uri: callbackUrl
            }),
          });
          
          const tokens = await response.json();
          console.log("Token response status:", response.status);
          console.log("Token response:", JSON.stringify({
            ...tokens,
            access_token: tokens.access_token ? `${tokens.access_token.substring(0, 10)}...` : undefined,
            refresh_token: tokens.refresh_token ? `${tokens.refresh_token.substring(0, 10)}...` : undefined
          }));
          
          if (!response.ok) {
            console.error("Token error:", tokens);
            throw new Error(tokens.message || "Failed to get access token");
          }
          
          return { tokens };
        } catch (error) {
          console.error("Error in token request:", error);
          throw error;
        }
      }
    },
    userinfo: {
      url: "https://api.twitch.tv/helix/users",
      async request(context) {
        const { tokens } = context;
        console.log("Userinfo request with token:", tokens.access_token ? tokens.access_token.substring(0, 10) + "..." : "undefined");
        
        if (!tokens.access_token) {
          throw new Error("No access token available");
        }
        
        const response = await fetch("https://api.twitch.tv/helix/users", {
          headers: {
            'Authorization': `Bearer ${tokens.access_token}`,
            'Client-Id': TWITCH_CONFIG.clientId,
          },
        });
        
        const data = await response.json();
        console.log("Twitch API response:", JSON.stringify(data));
        
        return data;
      }
    },
    profile(profile: any) {
      console.log("Profile data:", JSON.stringify(profile));
      
      if (!profile.data || !profile.data[0]) {
        throw new Error('Invalid profile data received from Twitch');
      }
      
      const userData = profile.data[0];
      return {
        id: userData.id,
        name: userData.display_name,
        username: userData.login,
        email: userData.email,
        image: userData.profile_image_url,
      };
    },
    checks: ["state"],
    style: {
      logo: "/twitch.svg",
      bg: "#65459B",
      text: "#fff"
    }
  };
}

export const authOptions: NextAuthOptions = {
  providers: [
    CustomTwitchProvider({
      clientId: TWITCH_CONFIG.clientId,
      clientSecret: TWITCH_CONFIG.clientSecret
    }),
  ],
  secret: process.env.NEXTAUTH_SECRET || (process.env.NODE_ENV === 'production' 
    ? `insecure-auto-generated-secret-${Date.now()}` 
    : 'development-secret-do-not-use-in-production'),
  debug: process.env.NODE_ENV === 'development',
  logger: {
    error(code, ...message) {
      logToCloudRun(`Auth Error: ${code}`, { message });
    },
    warn(code, ...message) {
      logToCloudRun(`Auth Warning: ${code}`, { message });
    },
    debug(code, ...message) {
      logToCloudRun(`Auth Debug: ${code}`, { message });
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 24 * 60 * 60, // 24 hours
  },
  callbacks: {
    async jwt({ token, account, user, profile }) {
      console.log("JWT callback called with account:", account ? JSON.stringify({
        ...account,
        access_token: account.access_token ? `${account.access_token.substring(0, 10)}...` : undefined
      }) : "undefined");
      
      // Save user data from initial sign in
      if (user) {
        token.id = user.id;
        token.name = user.name;
        token.username = user.username;
      }
      
      // Initial sign in
      if (account) {
        // Store tokens in the database
        try {
          if (account.access_token && account.refresh_token && account.expires_at) {
            await updateUserTokens(token.id as string, {
              accessToken: account.access_token,
              refreshToken: account.refresh_token,
              expiresAt: new Date(account.expires_at * 1000),
              scope: account.scope?.split(' ') || [],
            });
            console.log(`Stored tokens for user ${token.id}`);
          }
        } catch (error) {
          console.error('Error storing user tokens:', error);
        }
        
        return {
          accessToken: account.access_token,
          refreshToken: account.refresh_token,
          accessTokenExpires: account.expires_at ? account.expires_at * 1000 : Date.now() + 3600 * 1000,
          id: account.providerAccountId || user?.id || token.id,
          name: user?.name || token.name,
          username: user?.username || token.username,
        };
      }

      // Return previous token if the access token has not expired yet
      if (Date.now() < (token.accessTokenExpires as number)) {
        return token;
      }
      
      // Access token has expired, try to refresh it
      console.log("Access token has expired, refreshing...");
      return refreshAccessToken(token);
    },
    async session({ session, token }) {
      console.log("Session callback called with token:", token ? JSON.stringify({
        ...token,
        accessToken: token.accessToken ? `${token.accessToken.toString().substring(0, 10)}...` : undefined
      }) : "undefined");
      
      // Ensure session has user object with required id
      if (!session.user) {
        session.user = { id: token.id as string };
      } else if (!session.user.id) {
        session.user.id = token.id as string;
      }
      
      // Set access token
      session.accessToken = token.accessToken as string;
      
      // Add username to session if available
      if (token.name) {
        session.user.name = token.name as string;
      }
      
      // Add additional user data if available
      if (token.username) {
        session.user.username = token.username as string;
      }
      
      console.log("Session after modification:", JSON.stringify({
        ...session,
        accessToken: session.accessToken ? `${session.accessToken.substring(0, 10)}...` : undefined
      }));
      
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
};

async function refreshAccessToken(token: any) {
  try {
    console.log("Refreshing access token...");
    
    const response = await fetch("https://id.twitch.tv/oauth2/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: TWITCH_CONFIG.clientId,
        client_secret: TWITCH_CONFIG.clientSecret,
        grant_type: "refresh_token",
        refresh_token: token.refreshToken as string,
      }),
    });

    const refreshedTokens = await response.json();

    if (!response.ok) {
      console.error("Error refreshing access token:", refreshedTokens);
      return {
        ...token,
        error: "RefreshAccessTokenError",
      };
    }

    console.log("Access token refreshed successfully");

    return {
      ...token,
      accessToken: refreshedTokens.access_token,
      refreshToken: refreshedTokens.refresh_token ?? token.refreshToken, // Fall back to old refresh token
      accessTokenExpires: Date.now() + refreshedTokens.expires_in * 1000,
      // Preserve user information
      id: token.id,
      name: token.name,
      username: token.username,
    };
  } catch (error) {
    console.error("Error refreshing access token:", error);
    return {
      ...token,
      error: "RefreshAccessTokenError",
    };
  }
} 