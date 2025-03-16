/** @type {import('next').NextConfig} */
const nextConfig = {
    output: 'standalone',
    images: {
        domains: [
            'static-cdn.jtvnw.net',  // Twitch profile images
            'cdn.jtvnw.net',         // Alternate Twitch CDN domain
            'jtvnw.net',             // Base Twitch CDN domain
        ],
    },
    // Ensure proper handling of WebSocket connections
    experimental: {
        serverActions: true,
    },
    // Configure headers for SSE and WebSocket support
    async headers() {
        return [
            {
                source: '/api/:path*',
                headers: [
                    { key: 'Access-Control-Allow-Credentials', value: 'true' },
                    { key: 'Access-Control-Allow-Origin', value: '*' },
                    { key: 'Access-Control-Allow-Methods', value: 'GET,DELETE,PATCH,POST,PUT' },
                    { key: 'Access-Control-Allow-Headers', value: 'Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date' },
                ]
            }
        ]
    }
};

module.exports = nextConfig; 