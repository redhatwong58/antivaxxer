/**
 * ProductCard — ANTIVAXXER
 * [AV-037] v5.2.0 — price right-aligned (Bebas Neue), QUICK ADD red overlay
 * [AV-046] v5.3.3 — wishlist heart button top-right
 * [AV-048] v5.3.4 — Quick Add restructured: always rendered when onQuickView
 *   is provided, slides up on desktop hover, always visible and tappable on
 *   touch devices via @media (hover: none).
 * [AV-051] v5.3.7 — product status handling:
 *   - active     → normal QUICK ADD button
 *   - coming_soon → blue "COMING SOON" status badge, no Quick Add button,
 *                   click-through still works for product detail
 *   - prelaunch  → purple "PRE-ORDER" status badge, Quick Add reads "PRE-ORDER"
 *                   (still adds to cart — pre-orders fulfill on launch)
 *   - draft / archived → not returned by public API, never reaches this component
 * To rollback: cp _rollback/v5.3.3/components/product/ProductCard.js frontend/src/components/product/ProductCard.js
 */
'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import WishlistButton from '@/components/wishlist/WishlistButton';
import WishlistPrompt from '@/components/wishlist/WishlistPrompt';

export default function ProductCard({ product, onQuickView }) {
  const { id, name, slug, basePrice, badge, variantLabel, primaryImage, status } = product;
  const [showWishlistPrompt, setShowWishlistPrompt] = useState(false);
  const router = useRouter();

  const isComingSoon = status === 'coming_soon';
  const isPrelaunch = status === 'prelaunch';
  const allowQuickAdd = !isComingSoon; // prelaunch DOES allow add-to-cart

  // Prefetch the detail route so click-through is as fast as next/link
  useEffect(() => {
    if (slug) router.prefetch(`/shop/${slug}`);
  }, [router, slug]);

  const goToDetail = () => router.push(`/shop/${slug}`);
  const onKeyDown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goToDetail(); } };

  const handleQuickAdd = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (onQuickView) onQuickView(product);
  };

  // Status badge takes priority over the manual `badge` field if both exist
  // (a coming_soon product with a "NEW" admin badge should still show "COMING SOON")
  const statusBadge = isComingSoon
    ? { text: 'COMING SOON', bg: 'bg-blue-700' }
    : isPrelaunch
    ? { text: 'PRE-ORDER', bg: 'bg-purple-700' }
    : null;

  return (
    <div
      className="group relative cursor-pointer focus:outline-none focus:ring-2 focus:ring-av-red"
      role="link"
      tabIndex={0}
      aria-label={`View ${name}, $${basePrice}${isComingSoon ? ', coming soon' : ''}`}
      onClick={goToDetail}
      onKeyDown={onKeyDown}
    >
      <div className="block">
        {/* Image frame — also hosts the Quick Add overlay at the bottom */}
        <div className="relative aspect-square bg-av-gunmetal overflow-hidden">
          {primaryImage ? (
            <img
              src={primaryImage.url}
              alt={primaryImage.altText || name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              loading="lazy"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <span className="font-heading text-2xl tracking-widest text-av-bone-dim">AV</span>
            </div>
          )}

          {/* Status badge takes priority over manual badge */}
          {statusBadge ? (
            <span
              className={`absolute top-4 left-4 ${statusBadge.bg} text-av-bone font-heading
                          text-[11px] tracking-[2px] px-3 py-1 z-[2]`}
            >
              {statusBadge.text}
            </span>
          ) : badge && (
            <span
              className="absolute top-4 left-4 bg-av-red text-av-bone font-heading
                         text-[11px] tracking-[2px] px-3 py-1 z-[2]"
            >
              {badge}
            </span>
          )}

          {/* QUICK ADD — disabled entirely for coming_soon (no purchase path).
              For prelaunch, the label changes to "PRE-ORDER" but it still adds to cart. */}
          {onQuickView && allowQuickAdd && (
            <button
              type="button"
              onClick={handleQuickAdd}
              aria-label={`${isPrelaunch ? 'Pre-order' : 'Quick add'} ${name}`}
              className="quick-add-btn absolute left-0 right-0 bottom-0 bg-av-red/95
                         hover:bg-av-red py-3.5 text-center font-heading text-sm
                         tracking-[3px] text-av-bone z-[2] cursor-pointer border-none
                         transition-transform duration-300"
            >
              {isPrelaunch ? 'PRE-ORDER' : 'QUICK ADD'}
            </button>
          )}
        </div>

        {/* Info — name left, price right */}
        <div className="flex justify-between items-start pt-4 px-1">
          <div className="flex-1 min-w-0 pr-3">
            <p className="text-av-bone text-sm font-normal tracking-wide leading-snug truncate">
              {name}
            </p>
            {variantLabel && (
              <p className="text-av-bone-muted text-[11px] font-light mt-1">{variantLabel}</p>
            )}
          </div>
          <span className="font-heading text-lg tracking-wider whitespace-nowrap">
            ${basePrice.toFixed(2)}
          </span>
        </div>
      </div>

      {/* Wishlist heart — top-right of image, thumb-reachable on mobile */}
      <div
        className="absolute top-3 right-3 z-[3]"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <WishlistButton
          productId={id}
          size="sm"
          onPromptShow={() => setShowWishlistPrompt(true)}
        />
      </div>

      {/* Wishlist prompt */}
      <WishlistPrompt
        isOpen={showWishlistPrompt}
        onClose={() => setShowWishlistPrompt(false)}
      />

      {/* Hover/touch rules for the Quick Add button.
          Scoped via a class so the style only applies to this component. */}
      <style jsx>{`
        /* Desktop with hover: start hidden below the image, slide up on hover */
        @media (hover: hover) and (pointer: fine) {
          :global(.quick-add-btn) {
            transform: translateY(100%);
          }
          .group:hover :global(.quick-add-btn) {
            transform: translateY(0);
          }
        }
        /* Touch devices and no-hover environments: always visible */
        @media (hover: none), (pointer: coarse) {
          :global(.quick-add-btn) {
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
}
