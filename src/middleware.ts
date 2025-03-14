import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { recordPerformanceMetric } from './lib/monitoring';
import { getToken } from 'next-auth/jwt';

export async function middleware(request: NextRequest) {
  const startTime = Date.now();
  const requestId = crypto.randomUUID();

  try {
    // Add request ID to headers for tracing
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-request-id', requestId);

    // Check for authentication on dashboard routes
    if (request.nextUrl.pathname.startsWith('/dashboard')) {
      const token = await getToken({ req: request });
      if (!token) {
        return NextResponse.redirect(new URL('/auth/signin', request.url));
      }
    }

    const response = NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    });

    // Record response time
    const duration = Date.now() - startTime;
    recordPerformanceMetric(`api_response_time_${request.nextUrl.pathname}`, duration);

    // Add security headers
    response.headers.set('X-DNS-Prefetch-Control', 'off');
    response.headers.set('X-Frame-Options', 'DENY');
    response.headers.set('X-Content-Type-Options', 'nosniff');
    response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains'
    );
    response.headers.set(
      'Content-Security-Policy',
      "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://*.twitch.tv https://*.googleapis.com wss:;"
    );

    return response;
  } catch (error) {
    console.error(`Request ${requestId} failed:`, error);
    throw error;
  }
}

export const config = {
  matcher: [
    '/api/:path*',
    '/dashboard/:path*',
  ],
}; 