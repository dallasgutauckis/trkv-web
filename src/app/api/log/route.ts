import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { message, data, component } = body;

    const logEntry = {
      severity: "INFO",
      message,
      data,
      timestamp: new Date().toISOString(),
      component: component || "Client"
    };

    console.log(JSON.stringify(logEntry));

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error logging:', error);
    return NextResponse.json({ success: false, error: 'Failed to log' }, { status: 500 });
  }
} 