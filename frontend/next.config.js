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

  // API rewrites — proxy /api calls to Express backend in development
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api'}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
