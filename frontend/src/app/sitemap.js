/**
 * Sitemap — ANTIVAXXER
 *
 * [AV-023] feat: SEO structured data and sitemap
 *
 * Generates sitemap.xml with:
 * - Static pages (home, about, faq, resources, shop)
 * - Legal pages (terms, privacy, returns, shipping)
 * - Product pages (fetched from API)
 */

export default async function sitemap() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://antivaxxer.com';

  // Static pages
  const staticPages = [
    { url: `${siteUrl}`, lastModified: new Date(), changeFrequency: 'weekly', priority: 1.0 },
    { url: `${siteUrl}/shop`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${siteUrl}/about`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${siteUrl}/faq`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/resources`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.6 },
    { url: `${siteUrl}/terms`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteUrl}/privacy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteUrl}/returns`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
    { url: `${siteUrl}/shipping-policy`, lastModified: new Date(), changeFrequency: 'yearly', priority: 0.3 },
  ];

  // Dynamic product pages
  let productPages = [];
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
    const res = await fetch(`${apiUrl}/products?limit=500&status=active`, { next: { revalidate: 3600 } });
    if (res.ok) {
      const data = await res.json();
      productPages = (data.products || []).map((product) => ({
        url: `${siteUrl}/shop/${product.slug}`,
        lastModified: product.updatedAt ? new Date(product.updatedAt) : new Date(),
        changeFrequency: 'weekly',
        priority: 0.8,
      }));
    }
  } catch {
    // Sitemap still works without product data
  }

  return [...staticPages, ...productPages];
}
