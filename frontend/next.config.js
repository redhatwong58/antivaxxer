/** @type {import('next').NextConfig} */
const nextConfig = {
  // Enable React strict mode for catching common issues
  reactStrictMode: true,

  // Image optimization — allow images from S3/CloudFront
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.cloudfront.net',
      },
      {
        protocol: 'https',
        hostname: '*.s3.amazonaws.com',
      },
    ],
  },

  // Proxy unmatched /api/* to Express. `fallback` runs after App Router API routes
  // so NextAuth (/api/auth/*) is not sent to Express (that caused session 404s).
  async rewrites() {
    const destinationBase =
      process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    return {
      fallback: [
        {
          source: '/api/:path*',
          destination: `${destinationBase}/:path*`,
        },
      ],
    };
  },
};

module.exports = nextConfig;
