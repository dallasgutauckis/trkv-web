import { NextAuthOptions } from "next-auth";
import { TWITCH_CONFIG } from "@/config/twitch";
import type { OAuthConfig, OAuthUserConfig } from "next-auth/providers/oauth";

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
  throw new Error('NEXTAUTH_SECRET is required in production');
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
        response_type: "code"
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
        const callbackUrl = provider?.callbackUrl || "http://localhost:3000/api/auth/callback/twitch";
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
        name: userData.login || userData.display_name,
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
  secret: process.env.NEXTAUTH_SECRET || 'development-secret-do-not-use-in-production',
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
    async jwt({ token, account }) {
      console.log("JWT callback called with account:", account ? JSON.stringify({
        ...account,
        access_token: account.access_token ? `${account.access_token.substring(0, 10)}...` : undefined
      }) : "undefined");
      
      if (account) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.id = account.providerAccountId;
      }
      return token;
    },
    async session({ session, token }) {
      console.log("Session callback called with token:", token ? JSON.stringify({
        ...token,
        accessToken: token.accessToken ? `${token.accessToken.toString().substring(0, 10)}...` : undefined
      }) : "undefined");
      
      if (session.user) {
        session.user.id = token.id as string;
        (session as any).accessToken = token.accessToken;
      }
      return session;
    }
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
}; 