import { NextRequest, NextResponse } from "next/server";
import { ensureEventSubMonitoring } from "@/server";

export async function GET(request: NextRequest) {
  // Ensure EventSub monitoring is running
  await ensureEventSubMonitoring();
  
  return NextResponse.json({ status: "ok" });
}

export async function POST(request: NextRequest) {
  // Ensure EventSub monitoring is running
  await ensureEventSubMonitoring();
  
  return NextResponse.json({ status: "ok" });
}

// Add other HTTP methods as needed 