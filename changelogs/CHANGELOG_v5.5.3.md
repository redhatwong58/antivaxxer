# v5.5.3 — Critical bugfixes from senior code review

**Release:**
**Tracking:** [AV-072]
**Migration required:** NO

## Bug #1 — `extractOptionalUserId` reads wrong JWT field (CRITICAL)

**File:** `api/src/routes/checkout.js` line 46

**Root cause:** JWT is signed with `{ userId: user.id }` in auth.js (line 26).
Every other file that reads the JWT (`adminAuth.js`, `account.js`) correctly
reads `decoded.userId`. But `extractOptionalUserId` in checkout.js read
`decoded?.id || decoded?.sub` — neither field exists in the JWT payload.

**Impact:** `extractOptionalUserId` always returned `null` for logged-in users.
Every logged-in checkout created a guest order (`userId: null` on the order row).
Three downstream effects:
1. Orders never appeared in `/account/orders` for logged-in customers
2. Per-user promo code limits (`maxUsesPerUser`) never enforced — the check
   at checkout.js line 158 tests `if (userId && ...)` which was always false
3. Promo usage records were never created (line 249 checks `if (appliedPromoCode && userId)`)

**Fix:** Changed `decoded?.id || decoded?.sub` → `decoded?.userId`

**One-line change. Zero risk of regression — the function was always returning
null before; now it returns the actual user ID when authenticated.**

## Bug #2 — `shared/constants/` missing from v5.5.1 bundle (CRITICAL)

**Root cause:** My v5.5.1 bundle assembly script copied `api/`, `frontend/`,
and `dev/` directories but missed `shared/`. The file has existed since v1.0.0
and is imported by `checkout.js` and `admin.js`.

**Impact:** API would crash on startup with `MODULE_NOT_FOUND` when either
route file tries to `require('../../../shared/constants')`.

**Fix:** Restored `shared/constants/index.js` and `shared/package.json` from
the v5.0.0 bundle. Verified contents: `SHIPPING` (flat rate $5.99, free
threshold $75), `ORDER_STATUSES`, `PRODUCT_STATUSES`, `BADGES`, `SIZES`,
`CATEGORIES`.

## Validation

- Parse: 122/122 PASS (full codebase)
- Bugfix verification: 16/16 PASS
- JWT field name consistent across all 4 consumer files (auth.js signs
  `userId`, adminAuth.js reads `userId`, account.js reads `userId`,
  checkout.js now reads `userId`)

## Files

- `api/src/routes/checkout.js` — one-line fix on extractOptionalUserId
- `shared/constants/index.js` — restored (unchanged content from v1.0.0)
- `shared/package.json` — restored

## Install

    cp api/src/routes/checkout.js  ../antivaxxer/api/src/routes/
    cp -r shared/                  ../antivaxxer/shared/
    cp CHANGELOG_v5.5.3.md         ../antivaxxer/

No migration. No env var changes. No service restart needed beyond the
normal deploy cycle (App Runner/Railway auto-redeploys on push).
