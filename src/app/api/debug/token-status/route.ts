import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { appClient } from "@/lib/twitch-server";

interface TokenStatusResponse {
  valid: boolean;
  scopes: string[];
  expiresIn: number;
  error?: string;
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.name?.toLowerCase() !== "defnotdallas") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const tokenInfo = await appClient.getTokenInfo();
    const response: TokenStatusResponse = {
      valid: true,
      scopes: tokenInfo.scopes,
      expiresIn: 0, // We don't have access to expiration info for app tokens
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to get token info:", error);
    const response: TokenStatusResponse = {
      valid: false,
      scopes: [],
      expiresIn: 0,
      error: error instanceof Error ? error.message : "Unknown error",
    };
    return NextResponse.json(response, { status: 500 });
  }
} 