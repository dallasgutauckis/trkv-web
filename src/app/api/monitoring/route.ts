import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { type, severity, message, data } = await request.json();
        
        // In production, this will be logged to Cloud Run logs
        console.log(JSON.stringify({
            type,
            severity,
            message,
            data,
            timestamp: new Date().toISOString(),
            service: 'trkv-web',
            project_id: process.env.PROJECT_ID,
        }));
        
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in monitoring API:', error);
        return NextResponse.json({ error: 'Failed to log' }, { status: 500 });
    }
} 