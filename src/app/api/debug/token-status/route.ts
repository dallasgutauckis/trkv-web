import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { appClient } from "@/lib/twitch-server";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (session?.user?.name?.toLowerCase() !== "defnotdallas") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    const tokenInfo = await appClient.getTokenInfo();

    return NextResponse.json({
      valid: true,
      scopes: tokenInfo.scopes,
      expiresIn: tokenInfo.expiresInSeconds,
    });
  } catch (error) {
    console.error("Failed to get token info:", error);
    return NextResponse.json(
      {
        valid: false,
        scopes: [],
        expiresIn: 0,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
} 