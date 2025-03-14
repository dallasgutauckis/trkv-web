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
};

module.exports = nextConfig; 