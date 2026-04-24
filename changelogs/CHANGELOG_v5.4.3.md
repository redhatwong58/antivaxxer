# v5.4.3 — Wishlist sync retry queue

**Release:**
**Tracking:** [AV-062]
**Migration required:** NO

> Reconstructed during v5.5.1 handover bundle pass.

## The bug
When a logged-in user added items to their wishlist and the server sync
failed (network blip, API error), the heart showed as filled (optimistic
UI) but the item was NOT on the server. On next page load, `loadWishlist`
fetched the server state and overwrote the local state — the heart vanished.

## The fix
Pending sync operations are now tracked in a sessionStorage queue
(`av_wishlist_pending`). Failed adds/removes are queued and retried:

- **On each new action:** pending ops flush first, then the new op fires
- **On page load:** after fetching server state, pending ops are applied on top
- **Every 30 seconds:** a timer flushes any remaining pending ops
- **Deduplication:** if a user toggles the same item, only the latest action survives in the queue

Uses sessionStorage (not localStorage) so pending ops survive client-side navigation but not a full browser restart.

## Files changed
- `frontend/src/components/wishlist/WishlistContext.js` (rewritten — same API, new internals)

## Context API unchanged
Same exports as before: `wishlistIds`, `wishlistCount`, `isInWishlist`, `addToWishlist`, `removeFromWishlist`, `toggleWishlist`, `isLoggedIn`, `isHydrated`. No consumer components needed updates.

## Validation
- Parse: 1/1 PASS
- Structural QA: 26/26 PASS
