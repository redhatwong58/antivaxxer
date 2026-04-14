/**
 * ProductCard — ANTIVAXXER
 * [AV-037] Rewritten: v5.2.0 — price right-aligned (Bebas Neue), QUICK ADD red overlay
 * Primary click: navigates to /shop/{slug}. Quick Add overlay: opens modal.
 */
'use client';
import { useMemo } from 'react';
import Link from 'next/link';

const categoryImageFallbacks = {
  hoodies: '/images/products/categories/hoodies.jpg',
  tees: '/images/products/categories/tees.jpg',
  beanies: '/images/products/categories/beanies.jpg',
  jackets: '/images/products/categories/jackets.jpg',
  default: '/images/logo-home.png',
};

function getCategoryFallbackImage(category) {
  const slug = category?.slug || '';
  const name = (category?.name || '').toLowerCase();

  if (slug.includes('hoodie') || name.includes('hoodie')) return categoryImageFallbacks.hoodies;
  if (slug.includes('tee') || name.includes('tee')) return categoryImageFallbacks.tees;
  if (slug.includes('beanie') || name.includes('beanie')) return categoryImageFallbacks.beanies;
  if (slug.includes('jacket') || name.includes('jacket')) return categoryImageFallbacks.jackets;

  return categoryImageFallbacks.default;
}

export default function ProductCard({ product, onQuickView }) {
  const { name, slug, basePrice, badge, variantLabel, category, primaryImage } = product;
  const categoryFallback = useMemo(() => getCategoryFallbackImage(category), [category]);
  const imageSrc = primaryImage?.url || categoryFallback;

  return (
    <div className="group relative">
      <Link href={`/shop/${slug}`} className="block cursor-pointer"
        aria-label={`View ${name}, $${basePrice}`}>
        {/* Image */}
        <div className="relative aspect-square bg-av-gunmetal overflow-hidden">
          <img
            src={imageSrc}
            alt={primaryImage?.altText || `${name} — ${category?.name || 'Product'}`}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
            onError={(e) => {
              if (e.currentTarget.src.endsWith(categoryImageFallbacks.default)) {
                return;
              }
              if (e.currentTarget.src.endsWith(categoryFallback)) {
                e.currentTarget.src = categoryImageFallbacks.default;
                return;
              }
              e.currentTarget.src = categoryFallback;
            }}
          />
          {badge && (
            <span className="absolute top-4 left-4 bg-av-red text-av-bone font-heading
                             text-[11px] tracking-[2px] px-3 py-1 z-[2]">{badge}</span>
          )}
        </div>
        {/* Info — name left, price right */}
        <div className="flex justify-between items-start pt-4 px-1">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-av-bone text-sm font-normal tracking-wide leading-snug truncate">{name}</p>
            {variantLabel && <p className="text-av-bone-muted text-[11px] font-light mt-1">{variantLabel}</p>}
          </div>
          <span className="font-heading text-lg tracking-wider whitespace-nowrap">${basePrice.toFixed(2)}</span>
        </div>
      </Link>
      {/* QUICK ADD overlay — opens modal */}
      {onQuickView && (
        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); onQuickView(product); }}
          className="absolute left-0 right-0 bg-av-red/95 py-3.5 text-center font-heading
                     text-sm tracking-[3px] text-av-bone z-[2] translate-y-full group-hover:translate-y-0
                     transition-transform duration-300 cursor-pointer border-none"
          style={{ bottom: 'calc(100% - 100% + 0px)', top: 'auto', bottom: '72px' }}
          aria-label={`Quick add ${name}`}>
          QUICK ADD
        </button>
      )}
    </div>
  );
}
