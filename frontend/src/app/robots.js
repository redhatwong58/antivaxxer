/**
 * robots.txt — ANTIVAXXER
 *
 * [AV-023] feat: SEO structured data and sitemap
 *
 * Next.js App Router generates robots.txt from this file.
 */

export default function robots() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://antivaxxer.com';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/account/', '/checkout/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
