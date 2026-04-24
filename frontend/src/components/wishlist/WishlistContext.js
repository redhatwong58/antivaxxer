/**
 * WishlistContext — ANTIVAXXER
 *
 * [AV-046] v5.3.3: Optimistic wishlist with localStorage persistence + merge-on-login.
 * [AV-062] v5.4.3: Sync retry queue — failed server syncs are queued in
 *   sessionStorage and retried on next action or page load. Prevents the
 *   "ghost heart" problem where a user adds an item, sync fails silently,
 *   and the heart vanishes on page reload when server state overwrites.
 *
 * Design decisions (from product conversation):
 *   1. Guest users: wishlist stored in localStorage, heart fills immediately on tap
 *   2. Logged-in users: wishlist synced to /api/account/wishlist on the server
 *   3. On sign-in: guest localStorage wishlist is MERGED (union) into account wishlist
 *      — both sets survive, no data loss
 *   4. On sign-out: server state dropped, localStorage preserved for this browser session
 *   5. Heart state persists across page navigation via this context
 *   6. [v5.4.3] Failed syncs are queued and retried automatically — no silent data loss
 *
 * Sync retry queue (sessionStorage):
 *   Key: "av_wishlist_pending"
 *   Value: JSON array of { productId, action: 'add'|'remove' }
 *   Flushed on: next add/remove action, page load (loadWishlist), or 30s timer
 *   On success: entry removed from queue
 *   On failure: entry stays for next retry
 *   Cleared on: sign-out (pending ops are meaningless without auth)
 */

'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useSession } from 'next-auth/react';

const STORAGE_KEY = 'antivaxxer_wishlist_guest';
const PENDING_KEY = 'av_wishlist_pending';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const WishlistContext = createContext(null);

// === Pending queue helpers (sessionStorage) ===

function getPendingOps() {
  try {
    const raw = window.sessionStorage.getItem(PENDING_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function setPendingOps(ops) {
  try {
    if (ops.length === 0) window.sessionStorage.removeItem(PENDING_KEY);
    else window.sessionStorage.setItem(PENDING_KEY, JSON.stringify(ops));
  } catch { /* sessionStorage unavailable */ }
}

function addPendingOp(productId, action) {
  const ops = getPendingOps();
  // Remove any conflicting op for the same product (latest action wins)
  const filtered = ops.filter((op) => op.productId !== productId);
  filtered.push({ productId, action });
  setPendingOps(filtered);
}

function removePendingOp(productId) {
  const ops = getPendingOps().filter((op) => op.productId !== productId);
  setPendingOps(ops);
}

export function WishlistProvider({ children }) {
  const { data: session, status } = useSession();
  const [wishlistIds, setWishlistIds] = useState(new Set());
  const [isHydrated, setIsHydrated] = useState(false);
  const flushingRef = useRef(false);

  const isLoggedIn = status === 'authenticated' && !!session?.user?.apiToken;

  // === Flush pending ops to server ===
  const flushPendingOps = useCallback(async () => {
    if (!isLoggedIn || !session?.user?.apiToken || flushingRef.current) return;
    const ops = getPendingOps();
    if (ops.length === 0) return;

    flushingRef.current = true;
    for (const op of ops) {
      try {
        const res = await fetch(`${API_URL}/account/wishlist/${op.productId}`, {
          method: op.action === 'add' ? 'POST' : 'DELETE',
          headers: { Authorization: `Bearer ${session.user.apiToken}` },
        });
        if (res.ok || res.status === 409 || res.status === 404) {
          // 409 = already exists (add), 404 = already removed (delete) — both are success
          removePendingOp(op.productId);
        }
        // Other failures (500, network) — leave in queue for next retry
      } catch {
        // Network error — leave in queue
      }
    }
    flushingRef.current = false;
  }, [isLoggedIn, session?.user?.apiToken]);

  // Load initial state from localStorage (guest) or API (logged in)
  useEffect(() => {
    if (status === 'loading') return;

    async function loadWishlist() {
      // Start from whatever is in localStorage for this browser
      let localIds = [];
      try {
        const stored = window.localStorage.getItem(STORAGE_KEY);
        if (stored) localIds = JSON.parse(stored);
      } catch (e) {
        // localStorage unavailable (SSR, private browsing, etc.)
      }

      if (!isLoggedIn) {
        setWishlistIds(new Set(localIds));
        setIsHydrated(true);
        return;
      }

      // Logged in: fetch server wishlist, then merge with any local items
      try {
        const res = await fetch(`${API_URL}/account/wishlist`, {
          headers: { Authorization: `Bearer ${session.user.apiToken}` },
        });
        if (!res.ok) throw new Error('Failed to fetch wishlist');
        const data = await res.json();
        const serverIds = (data.wishlist || []).map((w) => w.productId);
        const merged = new Set([...serverIds, ...localIds]);

        // If local had items not on server, push them up (merge-on-login)
        const toUpload = localIds.filter((id) => !serverIds.includes(id));
        for (const productId of toUpload) {
          try {
            await fetch(`${API_URL}/account/wishlist/${productId}`, {
              method: 'POST',
              headers: { Authorization: `Bearer ${session.user.apiToken}` },
            });
          } catch (e) {
            // [AV-062] v5.4.3 — queue failed merges for retry
            addPendingOp(productId, 'add');
          }
        }

        // [AV-062] v5.4.3 — apply pending ops on top of server state.
        // This handles the case where a previous add/remove failed and
        // is still in the queue. Without this, the stale server state
        // would overwrite the user's intent.
        const pending = getPendingOps();
        for (const op of pending) {
          if (op.action === 'add') merged.add(op.productId);
          else merged.delete(op.productId);
        }

        // Clear local storage after successful merge
        try {
          window.localStorage.removeItem(STORAGE_KEY);
        } catch (e) {}

        setWishlistIds(merged);

        // Flush any pending ops now that we have a fresh server state
        // (runs async, doesn't block the UI)
        setTimeout(() => flushPendingOps(), 100);
      } catch (e) {
        // Fall back to local-only if API fails
        setWishlistIds(new Set(localIds));
      }
      setIsHydrated(true);
    }

    loadWishlist();
  }, [status, isLoggedIn, session?.user?.apiToken, flushPendingOps]);

  // [AV-062] v5.4.3 — periodic flush every 30 seconds while logged in
  useEffect(() => {
    if (!isLoggedIn) return;
    const interval = setInterval(flushPendingOps, 30000);
    return () => clearInterval(interval);
  }, [isLoggedIn, flushPendingOps]);

  // Persist to localStorage whenever wishlist changes (guest mode only)
  useEffect(() => {
    if (!isHydrated || isLoggedIn) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...wishlistIds]));
    } catch (e) {}
  }, [wishlistIds, isLoggedIn, isHydrated]);

  const isInWishlist = useCallback(
    (productId) => wishlistIds.has(productId),
    [wishlistIds]
  );

  const addToWishlist = useCallback(
    async (productId) => {
      // Optimistic update first — UI fills immediately
      setWishlistIds((prev) => {
        const next = new Set(prev);
        next.add(productId);
        return next;
      });

      // Background sync to server if logged in
      if (isLoggedIn) {
        // [AV-062] v5.4.3 — flush any pending ops first, then try this one
        await flushPendingOps();
        try {
          const res = await fetch(`${API_URL}/account/wishlist/${productId}`, {
            method: 'POST',
            headers: { Authorization: `Bearer ${session.user.apiToken}` },
          });
          if (!res.ok && res.status !== 409) {
            // 409 = already exists, that's fine. Anything else = queue for retry.
            addPendingOp(productId, 'add');
          }
        } catch (e) {
          // Network failure — queue for retry
          addPendingOp(productId, 'add');
        }
      }
    },
    [isLoggedIn, session?.user?.apiToken, flushPendingOps]
  );

  const removeFromWishlist = useCallback(
    async (productId) => {
      // Optimistic update first
      setWishlistIds((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });

      // Background sync to server if logged in
      if (isLoggedIn) {
        await flushPendingOps();
        try {
          const res = await fetch(`${API_URL}/account/wishlist/${productId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${session.user.apiToken}` },
          });
          if (!res.ok && res.status !== 404) {
            // 404 = already removed, fine. Anything else = queue.
            addPendingOp(productId, 'remove');
          }
        } catch (e) {
          addPendingOp(productId, 'remove');
        }
      }
    },
    [isLoggedIn, session?.user?.apiToken, flushPendingOps]
  );

  const toggleWishlist = useCallback(
    (productId) => {
      if (wishlistIds.has(productId)) {
        removeFromWishlist(productId);
        return false; // was removed
      } else {
        addToWishlist(productId);
        return true; // was added
      }
    },
    [wishlistIds, addToWishlist, removeFromWishlist]
  );

  const value = {
    wishlistIds,
    wishlistCount: wishlistIds.size,
    isInWishlist,
    addToWishlist,
    removeFromWishlist,
    toggleWishlist,
    isLoggedIn,
    isHydrated,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return ctx;
}
