import { getServerSession } from "next-auth";
import { NextResponse } from "next/server";
import { authOptions } from "@/lib/auth";
import { addAuditLog } from "@/services/twitch-eventsub";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (session?.user?.name?.toLowerCase() !== "defnotdallas") {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  try {
    // Add a test audit log entry
    await addAuditLog({
      channelId: "test_channel",
      action: "VIP_GRANT_FAILED",
      username: "TestUser",
      userId: "test_user",
      details: {
        rewardId: "test_reward",
        error: "This is a test redemption event",
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to add test audit log:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
} 