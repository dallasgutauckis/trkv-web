// Import server initialization
import "@/server-init";

// Export an empty config object to make this a valid middleware file
export const config = {
  matcher: '/api/:path*',
}; 