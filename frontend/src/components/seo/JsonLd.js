/**
 * JSON-LD Structured Data Components — ANTIVAXXER
 *
 * [AV-023] feat: SEO structured data and sitemap
 *
 * Generates schema.org JSON-LD for:
 * - Organization (brand identity)
 * - Product (individual products with pricing)
 * - BreadcrumbList (navigation path)
 */

// Organization schema — added to root layout
export function OrganizationJsonLd() {
  const data = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'ANTIVAXXER',
    url: process.env.NEXT_PUBLIC_SITE_URL || 'https://antivaxxer.com',
    description: 'Premium streetwear for the health freedom movement.',
    logo: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/images/logo.png`,
    sameAs: [
      'https://instagram.com/antivaxxer',
      'https://facebook.com/antivaxxer',
      'https://x.com/antivaxxer',
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// Product schema — added to product detail pages
export function ProductJsonLd({ product }) {
  if (!product) return null;

  const data = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: product.description || `${product.name} — ANTIVAXXER premium streetwear.`,
    brand: { '@type': 'Brand', name: 'ANTIVAXXER' },
    sku: product.slug,
    image: product.primaryImage || undefined,
    offers: {
      '@type': 'Offer',
      price: product.basePrice,
      priceCurrency: 'USD',
      availability: product.totalStock > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      url: `${process.env.NEXT_PUBLIC_SITE_URL || ''}/shop/${product.slug}`,
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

// Breadcrumb schema
export function BreadcrumbJsonLd({ items }) {
  if (!items?.length) return null;

  const data = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url ? `${process.env.NEXT_PUBLIC_SITE_URL || ''}${item.url}` : undefined,
    })),
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}
