import NextAuth from "next-auth";
import TwitchProvider from "next-auth/providers/twitch";
import { TWITCH_CONFIG } from "@/config/twitch";

const handler = NextAuth({
  providers: [
    TwitchProvider({
      clientId: TWITCH_CONFIG.clientId,
      clientSecret: TWITCH_CONFIG.clientSecret,
      authorization: {
        params: {
          scope: TWITCH_CONFIG.scopes.join(' ')
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.accessToken = account.access_token;
        token.refreshToken = account.refresh_token;
        token.expiresAt = account.expires_at! * 1000;
        token.id = (profile as any).sub;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
      }
      return {
        ...session,
        accessToken: token.accessToken,
        refreshToken: token.refreshToken,
        expiresAt: token.expiresAt,
      };
    },
  },
  pages: {
    signIn: '/auth/signin',
    error: '/auth/error',
  },
  session: {
    strategy: 'jwt',
  },
  debug: process.env.NODE_ENV === 'development',
  logger: {
    error(code, ...message) {
      console.error(code, ...message);
    },
    warn(code, ...message) {
      console.warn(code, ...message);
    },
    debug(code, ...message) {
      console.debug(code, ...message);
    },
  },
});

export { handler as GET, handler as POST }; 