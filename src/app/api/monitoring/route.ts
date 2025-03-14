import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    try {
        const { type, severity, message, data } = await request.json();
        
        // In production, this will be logged to Cloud Run logs
        const logEntry = {
            type,
            severity: severity || 'INFO',
            message,
            data,
            timestamp: new Date().toISOString(),
            service: 'trkv-web',
            project_id: process.env.PROJECT_ID,
            environment: process.env.NODE_ENV,
            request_id: request.headers.get('x-request-id'),
            url: request.url,
            method: request.method,
        };

        // Log in a format that Cloud Run can parse
        console.log(JSON.stringify(logEntry));
        
        return NextResponse.json({ success: true });
    } catch (error) {
        // Log the error in a format that Cloud Run can parse
        console.error(JSON.stringify({
            severity: 'ERROR',
            message: 'Error in monitoring API',
            error: error instanceof Error ? {
                name: error.name,
                message: error.message,
                stack: error.stack
            } : error,
            timestamp: new Date().toISOString(),
            service: 'trkv-web',
            project_id: process.env.PROJECT_ID,
            environment: process.env.NODE_ENV,
        }));
        
        return NextResponse.json({ error: 'Failed to log' }, { status: 500 });
    }
} 