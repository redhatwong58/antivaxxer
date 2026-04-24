/**
 * WishlistButton — ANTIVAXXER
 *
 * [AV-046] v5.3.3: Reusable heart button for product cards, modals, and detail pages.
 *
 * Accessibility / UX:
 *   - 44x44 touch target (Apple HIG / Material Design minimum)
 *   - 20px visible icon inside the larger tap area
 *   - Scale animation on tap for haptic-feel feedback
 *   - ARIA pressed state reflects filled/unfilled
 *   - Filled state = red heart, unfilled = bone outline
 *   - Triggers WishlistPrompt when guest user adds first item
 *
 * Usage:
 *   <WishlistButton productId={product.id} onPromptShow={handlePrompt} />
 */

'use client';

import { useState } from 'react';
import { useWishlist } from './WishlistContext';

export default function WishlistButton({ productId, onPromptShow, size = 'md', className = '' }) {
  const { isInWishlist, toggleWishlist, isLoggedIn } = useWishlist();
  const [isAnimating, setIsAnimating] = useState(false);

  const filled = isInWishlist(productId);

  // Size presets
  const sizeClasses = {
    sm: 'w-9 h-9',     // 36x36 — compact product card
    md: 'w-11 h-11',   // 44x44 — default, modal, detail page
    lg: 'w-12 h-12',   // 48x48 — hero emphasis
  };
  const iconSizes = {
    sm: 18,
    md: 20,
    lg: 24,
  };

  const handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();

    // Scale animation — 150ms out, 150ms back
    setIsAnimating(true);
    setTimeout(() => setIsAnimating(false), 300);

    const wasAdded = toggleWishlist(productId);

    // If this is a guest user and they just ADDED an item, show the prompt
    // Do not show on removes — would be annoying
    if (wasAdded && !isLoggedIn && onPromptShow) {
      onPromptShow();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={filled ? 'Remove from wishlist' : 'Add to wishlist'}
      aria-pressed={filled}
      className={`
        ${sizeClasses[size]}
        flex items-center justify-center
        bg-av-black/40 backdrop-blur-sm
        border border-av-bone-faint
        hover:border-av-red
        transition-all duration-200
        ${isAnimating ? 'scale-125' : 'scale-100'}
        ${className}
      `}
    >
      <svg
        width={iconSizes[size]}
        height={iconSizes[size]}
        viewBox="0 0 24 24"
        fill={filled ? '#6A0E0E' : 'none'}
        stroke={filled ? '#6A0E0E' : '#E8E5DD'}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="transition-all duration-200"
      >
        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
      </svg>
    </button>
  );
}
