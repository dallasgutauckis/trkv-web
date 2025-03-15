import { DefaultSession } from "next-auth";
import NextAuth from "next-auth";

declare module "next-auth" {
  /**
   * Returned by `useSession`, `getSession` and received as a prop on the `SessionProvider` React Context
   */
  interface Session {
    user: {
      id: string;
      name?: string;
      email?: string;
      image?: string;
      username?: string;
    };
    accessToken: string;
    expires: string;
  }

  interface User {
    id: string;
    name?: string;
    email?: string;
    image?: string;
    username?: string;
  }
}

declare module "next-auth/jwt" {
  /** Returned by the `jwt` callback and `getToken`, when using JWT sessions */
  interface JWT {
    id: string;
    accessToken: string;
    refreshToken: string;
    accessTokenExpires: number;
    name?: string;
    username?: string;
  }
} 