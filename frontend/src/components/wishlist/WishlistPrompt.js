/**
 * WishlistPrompt — ANTIVAXXER
 *
 * [AV-046] v5.3.3: Non-blocking prompt that encourages sign-up after first wishlist save.
 *
 * UX design (from product conversation):
 *   - Mobile: slides up from bottom as a sheet (native pattern)
 *   - Desktop: corner toast in bottom-right
 *   - Auto-dismisses after 6 seconds
 *   - Can be swiped down (mobile) or X'd (both)
 *   - Framed as "upgrade" not "paywall": "Sync across devices" not "Sign in to save"
 *   - Shows once per session — uses sessionStorage to track "seen" state
 *   - Never blocks the product content behind it
 *
 * Parent manages visibility via `isOpen` prop. Component itself handles
 * the 6-second auto-dismiss and the "seen this session" flag.
 */

'use client';

import { useEffect } from 'react';
import Link from 'next/link';

const SEEN_KEY = 'antivaxxer_wishlist_prompt_seen';

export default function WishlistPrompt({ isOpen, onClose }) {
  // Auto-dismiss after 6 seconds
  useEffect(() => {
    if (!isOpen) return;
    const timer = setTimeout(() => {
      onClose();
    }, 6000);
    return () => clearTimeout(timer);
  }, [isOpen, onClose]);

  // Track "seen this session" so we don't nag
  useEffect(() => {
    if (isOpen) {
      try {
        window.sessionStorage.setItem(SEEN_KEY, '1');
      } catch (e) {}
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-x-0 bottom-0 md:inset-auto md:bottom-6 md:right-6 z-[999] pointer-events-none wishlist-prompt-slide-up"
      role="status"
      aria-live="polite"
    >
      <div
        className="pointer-events-auto
                   mx-auto md:mx-0 max-w-md md:max-w-sm
                   bg-av-black border-t border-av-bone-faint md:border
                   shadow-2xl md:shadow-xl
                   p-5 md:p-6"
      >
        {/* Close button (top right) */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Dismiss"
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center
                     text-av-bone-muted hover:text-av-bone transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        {/* Heart icon + headline */}
        <div className="flex items-start gap-3 mb-3 pr-6">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="#6A0E0E"
            stroke="#6A0E0E"
            strokeWidth="1.5"
            className="flex-shrink-0 mt-0.5"
          >
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
          </svg>
          <div>
            <p className="font-heading text-base tracking-wider text-av-bone">Saved to wishlist</p>
            <p className="text-sm text-av-bone-muted font-light leading-snug mt-1">
              Create an account to sync your favorites across devices.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <Link
            href="/account/register"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-av-red text-av-bone
                       text-xs tracking-[2px] uppercase font-heading
                       text-center hover:bg-av-red-hover transition-colors"
          >
            Create Account
          </Link>
          <Link
            href="/account/login"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 border border-av-bone-dim text-av-bone
                       text-xs tracking-[2px] uppercase font-heading
                       text-center hover:border-av-bone transition-colors"
          >
            Sign In
          </Link>
        </div>
      </div>
    </div>
  );
}

// Helper: check if user has already seen the prompt this session
export function hasSeenWishlistPrompt() {
  try {
    return window.sessionStorage.getItem(SEEN_KEY) === '1';
  } catch (e) {
    return false;
  }
}
