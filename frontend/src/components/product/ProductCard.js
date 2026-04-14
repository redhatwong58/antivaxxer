/**
 * ProductCard — ANTIVAXXER
 * [AV-037] Rewritten: v5.2.0 — price right-aligned (Bebas Neue), QUICK ADD red overlay
 * Primary click: navigates to /shop/{slug}. Quick Add overlay: opens modal.
 */
'use client';
import Link from 'next/link';
export default function ProductCard({ product, onQuickView }) {
  const { name, slug, basePrice, badge, variantLabel, colors, primaryImage } = product;
  return (
    <div className="group relative">
      <Link href={`/shop/${slug}`} className="block cursor-pointer"
        aria-label={`View ${name}, $${basePrice}`}>
        {/* Image */}
        <div className="relative aspect-square bg-av-gunmetal overflow-hidden">
          {primaryImage ? (
            <img src={primaryImage.url} alt={primaryImage.altText || name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="font-heading text-2xl tracking-widest text-av-bone-dim">AV</span>
            </div>
          )}
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
