# ANTIVAXXER — v5.6.0 Engineering Execution Plan

**Author:** Senior code review
**Base version:** v5.5.5-final (203 files, fully verified)
**Scope:** 15 improvements identified during full code review
**Audience:** Any developer(s) executing this work

This document defines the execution order, dependency chains, risk
assessment, and verification criteria for every improvement. It is
designed so two developers can work in parallel on independent tracks
without stepping on each other's code.

---

## Ground rules

1. **No change ships without verification.** Every item has a "Verify"
   section. Run it before committing.
2. **One item per commit.** Each numbered item below becomes one commit
   with a clear message. Squashing later is fine, but granular commits
   make rollback trivial.
3. **If a change touches the checkout or webhook path, stop and
   re-read the atomic transaction in `webhooks.js` lines 158-221.**
   These are the most sensitive 63 lines in the codebase.
4. **If a change touches the API response shape, grep the entire
   frontend for every field you're adding/removing.** The API and
   frontend are in the same repo but have no shared TypeScript types —
   the only contract is the JSON shape.
5. **Test after every item, not at the end.** Run the parse validator
   (122 files) and the regression script after every commit.

---

## Dependency graph

```
                    ┌────────────────────┐
                    │  WS-1: inStock     │
                    │  (API + frontend)  │
                    └────┬───────────────┘
                         │ depends on
                    ┌────▼───────────────┐
                    │  WS-2: product list│
                    │  inStock fix       │
                    └────────────────────┘

  Independent tracks (can run in parallel):

  TRACK A (API)              TRACK B (Frontend)         TRACK C (Emails)
  ─────────────              ──────────────────         ────────────────
  WS-1  inStock API field    WS-1  inStock frontend    WS-9  order confirm CTA
  WS-2  list inStock fix     WS-5  next/image swap     WS-10 welcome promo
  WS-3  JWT_EXPIRES env      WS-6  api.js migration    WS-11 abandoned cart images
  WS-4  checkout parallel    WS-8  search dead var
  WS-7  dashboard query      WS-12 account.js exports
  WS-13 loginLimiter split
  WS-14 CORS www
  WS-15 promo userId (post-launch)
```

**Critical path:** WS-1 must complete before WS-2 starts (WS-2 depends on
the `inStock` field pattern established in WS-1). Everything else is
independent.

---

## Execution order (recommended)

The items are numbered WS-1 through WS-15 in the order they should be
executed. Items marked [PARALLEL-SAFE] can run alongside other items
without conflicts. Items marked [SEQUENTIAL] must complete before the
next numbered item starts.

---

### WS-1 — Add `inStock` boolean to product detail API response [SEQUENTIAL]

**Priority:** P0 — every product page currently displays wrong stock info
**Risk:** LOW — adding a new field, not changing existing ones
**Files touched:** 2

**Problem:**
The product detail endpoint (`GET /api/products/:slug`) returns variants
mapped to `{ id, sku, color, size, price, available }`. The field
`stockQty` is intentionally excluded to prevent competitor scraping. But
the frontend product detail page (`frontend/src/app/shop/[slug]/page.js`)
reads `selectedVariant.stockQty` in 4 places (lines 324, 328, 348, 360).

Since `stockQty` is `undefined` on the client, `undefined > 0` evaluates
to `false` (NaN comparison). Net effect: every variant shows red "Out of
Stock" text, BUT the Add to Cart button remains clickable (because
`undefined <= 0` is also `false` via NaN). Contradictory UX.

**Plan:**

Step 1 — API (`api/src/routes/products.js`, product detail endpoint):
Add `inStock: v.stockQty > 0` to the variant mapping at ~line 211.
Do NOT add raw `stockQty` — the intentional exclusion is correct.

The variant response shape changes from:
```js
{ id, sku, color, size, price, available }
```
to:
```js
{ id, sku, color, size, price, available, inStock }
```

This is purely additive. No existing field is removed or renamed.

Step 2 — Frontend (`frontend/src/app/shop/[slug]/page.js`):
Replace all 4 occurrences of `stockQty` references:

| Line | Before | After |
|------|--------|-------|
| ~324 | `selectedVariant.stockQty > 0` | `selectedVariant.inStock` |
| ~328 | `selectedVariant.stockQty > 0 ? 'In Stock' : 'Out of Stock'` | `selectedVariant.inStock ? 'In Stock' : 'Out of Stock'` |
| ~348 | `disabled={selectedVariant && selectedVariant.stockQty <= 0}` | `disabled={selectedVariant && !selectedVariant.inStock}` |
| ~360 | `selectedVariant?.stockQty <= 0` | `!selectedVariant?.inStock` |

**Downstream check:**
- `ProductModal.js` — does NOT read `stockQty` or `inStock`. No change needed.
- `ProductCard.js` — does NOT read `stockQty` or `inStock`. No change needed.
- `CartContext.js` — stores `variantId`, not stock info. No change needed.
- `checkout.js` (API) — re-validates stock server-side. Not affected.
- Admin pages — use `/api/admin/products/:id` which returns full variant
  objects (including `stockQty`) via a separate route. Not affected.

**Verify:**
1. Parse 122/122
2. `grep -rn "stockQty" frontend/src/` returns zero hits (only API files)
3. `grep -rn "inStock" frontend/src/app/shop/` shows the 4 replacement lines
4. API response for `/api/products/:slug` includes `inStock` on each variant
5. API response still does NOT include `stockQty`

---

### WS-2 — Fix product list `inStock` to check actual stock [SEQUENTIAL — after WS-1]

**Priority:** P0 — sold-out products show as "in stock" on the grid
**Risk:** LOW — changing a derived boolean, not the query shape
**Files touched:** 1

**Problem:**
The product list endpoint (`GET /api/products`) computes
`inStock: product.variants.length > 0`. This is always `true` if any
variant record exists, regardless of stock. A product with 10 variants
all at 0 stock shows as "in stock."

**Plan:**

Step 1 — The current Prisma `select` for variants in the list query
(~line 78) does NOT include `stockQty`:
```js
select: { id: true, colorId: true, sizeId: true, sku: true,
          priceOverride: true, isActive: true }
```

Add `stockQty: true` to this select. This field is used only in the
server-side transformation — it is NOT passed to the API response.

Step 2 — Change the `inStock` calculation (~line 111) from:
```js
inStock: product.variants.length > 0,
```
to:
```js
inStock: product.variants.some(v => v.stockQty > 0),
```

**Downstream check:**
- The `stockQty` value is consumed inside the `.map()` transformation
  and NOT included in the output object. The API response shape does
  not change — `inStock` was already a boolean field. Only its value
  becomes accurate.
- Frontend `ProductCard.js` doesn't currently read `inStock` from the
  list response, but this fixes it for future use and for any
  filtering logic.

**Verify:**
1. Parse 122/122
2. API response for `/api/products` still has `inStock` as a boolean
3. API response does NOT expose `stockQty` anywhere
4. A product with all variants at 0 stock returns `inStock: false`

---

### WS-3 — Make `JWT_EXPIRES` configurable via environment [PARALLEL-SAFE]

**Priority:** P1 — config should honor what the docs tell operators to set
**Risk:** NONE — adding an env var fallback to a constant
**Files touched:** 1

**Problem:**
`api/src/lib/jwt.js` has `const JWT_EXPIRES = '7d'` hardcoded. The
runbooks tell operators to create a `JWT_EXPIRES` secret, but the code
ignores it.

**Plan:**
Change line 10 of `api/src/lib/jwt.js` from:
```js
const JWT_EXPIRES = '7d';
```
to:
```js
const JWT_EXPIRES = process.env.JWT_EXPIRES || '7d';
```

**Downstream check:**
- `auth.js` imports `JWT_EXPIRES` and passes it to `jwt.sign()`. No change.
- No other file references `JWT_EXPIRES`.
- If env var is not set, behavior is identical to today.

**Verify:**
1. Parse 122/122
2. `grep "JWT_EXPIRES" api/src/lib/jwt.js` shows `process.env.JWT_EXPIRES`
3. `grep "JWT_EXPIRES" api/src/routes/auth.js` still imports from `../lib/jwt`

---

### WS-4 — Parallelize checkout DB queries [PARALLEL-SAFE]

**Priority:** P2 — ~100-200ms latency reduction under load
**Risk:** MEDIUM — touches the revenue-critical checkout path
**Files touched:** 1

**Problem:**
Checkout makes 5-7 sequential DB queries. Steps 1 (variant lookup) and
2 (promo code lookup) are independent and can run in parallel. Step 6
(promo record re-fetch) is redundant — the same record was already
fetched in step 2.

**Plan:**

Step 1 — Parallelize variant + promo lookups. Currently (~lines 65-80
and ~148):
```js
const variants = await prisma.variant.findMany({ ... });
// ... validation loop ...
const promo = await prisma.promoCode.findUnique({ ... });
```

Restructure to:
```js
const [variants, promoRecord] = await Promise.all([
  prisma.variant.findMany({ ... }),
  promoCode
    ? prisma.promoCode.findUnique({ where: { code: promoCode.toUpperCase() } })
    : Promise.resolve(null),
]);
```

Then use `promoRecord` (already fetched) in the validation block instead
of the separate `findUnique`.

Step 2 — Remove redundant re-fetch at ~line 254:
```js
// BEFORE (redundant):
const promoRecord = await prisma.promoCode.findUnique({
  where: { code: appliedPromoCode },
});

// AFTER (reuse from step 1):
// promoRecord is already in scope from the Promise.all above
```

**CRITICAL: The promo validation logic between lines 148-178 must
remain exactly as-is.** Only the fetch is being parallelized — the
validation logic (date checks, usage limits, per-user limits) runs
after both fetches complete. The logic flow does not change.

**CRITICAL: The `promoUsage.create` and `promoCode.update` at lines
258-265 must NOT be parallelized.** They modify data and have an
implicit ordering requirement (create usage before incrementing count,
for crash-safety).

**Downstream check:**
- Webhook handler is unaffected (different code path).
- Promo validate endpoint is unaffected (separate route).
- Frontend is unaffected (same API response shape).

**Verify:**
1. Parse 122/122
2. Manual test: checkout with promo code still validates correctly
3. Manual test: checkout without promo code still works
4. Manual test: per-user promo limit still enforced
5. No new Prisma queries added (total should decrease by 1)

---

### WS-5 — Replace `<img>` with `next/image` [PARALLEL-SAFE]

**Priority:** P1 — mobile performance, Core Web Vitals, SEO
**Risk:** LOW — visual rendering changes possible, test each one
**Files touched:** 7

**Problem:**
All 7 image tags in the frontend use raw `<img>`. This misses Next.js
automatic lazy loading, responsive srcsets, WebP conversion, and size
optimization. The `next.config.js` already has `remotePatterns` for
CloudFront — the infrastructure is ready.

**Plan:**

Convert each `<img>` tag to `<Image>` from `next/image`. The 7 locations:

| # | File | Image type | Notes |
|---|------|-----------|-------|
| 1 | `components/cart/CartDrawer.js:53` | Cart item thumbnail | Remote (CloudFront). Needs `width`/`height` or `fill`. |
| 2 | `components/layout/Header.js:40` | Logo (nav) | Local (`/images/logo-nav.png`). Static import or public path. |
| 3 | `components/home/HeroSection.js:22` | Logo (hero) | Local (`/images/logo.png`). Static import or public path. |
| 4 | `app/shop/[slug]/page.js:220` | Product gallery image | Remote (CloudFront). `fill` with `object-cover`. |
| 5 | `app/account/wishlist/page.js:85` | Wishlist thumbnail | Remote (CloudFront). `fill` with `object-cover`. |
| 6 | `app/search/page.js:69` | Search result thumbnail | Remote (CloudFront). `fill` with `object-cover`. |
| 7 | `app/admin/page.js:139` | Top seller thumbnail | Remote (CloudFront). Small (40x40). |

**Approach per image:**

For remote images with `object-cover` in a container div:
```jsx
// BEFORE
<img src={url} alt="..." className="w-full h-full object-cover" />

// AFTER
import Image from 'next/image';
<Image src={url} alt="..." fill className="object-cover" />
// Parent div must have: position: relative (add if missing)
```

For local logo images with explicit dimensions:
```jsx
// BEFORE
<img src="/images/logo.png" alt="ANTIVAXXER" className="h-8" />

// AFTER
import Image from 'next/image';
<Image src="/images/logo.png" alt="ANTIVAXXER" width={120} height={32} />
```

**CAUTION:** Each conversion must be visually tested. `next/image`
applies different sizing behavior than raw `<img>`. Common issues:
- Container needs `position: relative` for `fill` to work
- `className` on `<Image>` applies to the `<img>` tag inside, not a wrapper
- `priority` prop needed for above-the-fold images (hero logo, header logo)

**Recommended execution: one file at a time, visually verify after each.**

**Downstream check:**
- No API changes.
- No data flow changes.
- Visual regression only — verify each component looks correct.

**Verify:**
1. Parse 122/122
2. `grep -rn "<img " frontend/src/` returns 0 hits
3. `grep -rn "next/image" frontend/src/` returns 7 hits
4. Dev server: visually verify each component renders correctly
5. Product images lazy-load (check Network tab — images below fold
   should not load until scrolled into view)

---

### WS-6 — Migrate pages to centralized `api.js` client [PARALLEL-SAFE]

**Priority:** P2 — code quality, reduces boilerplate
**Risk:** LOW per page, but 22 pages to touch — do in batches
**Files touched:** 22 frontend pages

**Problem:**
`frontend/src/lib/api.js` defines a clean centralized fetch wrapper
with error handling, but zero pages use it. All 22 pages duplicate
fetch boilerplate: `const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api'`,
manual `res.ok` checks, manual `res.json()`, inconsistent error handling.

**Plan:**

**Batch 1 — Read-only public pages (lowest risk):**
1. `shop/page.js` — product list
2. `shop/[slug]/page.js` — product detail
3. `search/page.js` — search results
4. `faq/page.js`, `about/page.js` — static pages (if they fetch)

**Batch 2 — Auth-required pages:**
5. `account/orders/page.js` — order list
6. `account/orders/[id]/page.js` — order detail
7. `account/wishlist/page.js` — wishlist

**Batch 3 — Auth forms (need special handling for credentials):**
8. `account/login/page.js`
9. `account/register/page.js`
10. `account/forgot-password/page.js`
11. `account/reset-password/[token]/page.js`

**Batch 4 — Checkout + cart (revenue-critical — extra caution):**
12. `checkout/page.js`
13. `checkout/confirmation/page.js`
14. `cart/recover/page.js`

**Batch 5 — Admin pages:**
15-22. All admin pages

**IMPORTANT:** The `api.js` client currently does NOT include auth
headers. Before migrating auth-required pages, extend the client:
```js
// Add to api.js:
const authGet = (path, token) => request(path, {
  method: 'GET',
  headers: { 'Authorization': `Bearer ${token}` },
});
```

**IMPORTANT:** `checkout/page.js` uses `session?.user?.apiToken` for
the auth header. This must be preserved when migrating to the
centralized client. Do not assume all pages use the same auth pattern.

**Execute one batch at a time. Test after each batch.**

**Verify (per batch):**
1. Parse 122/122
2. Page loads correctly in dev
3. API calls succeed (check Network tab)
4. Error states display correctly (disconnect API, verify error message)

---

### WS-7 — Optimize admin dashboard variant query [PARALLEL-SAFE]

**Priority:** P2 — reduces unnecessary data transfer
**Risk:** NONE — moving a filter from JS to SQL
**Files touched:** 1

**Problem:**
Admin dashboard fetches ALL active variants (`take: 200`) then filters
`stockQty < threshold` in JavaScript. Wasteful at 200+ variants.

**Plan:**
In `api/src/routes/admin.js`, change the `lowStockVariants` query
(~line 1504) from:
```js
prisma.variant.findMany({
  where: { isActive: true },
  ...
  take: 200,
})
```
to:
```js
prisma.variant.findMany({
  where: {
    isActive: true,
    stockQty: { lt: parseInt(process.env.INVENTORY_WARNING_THRESHOLD) || 15 },
  },
  ...
  // remove take: 200 — the WHERE clause handles filtering now
})
```

Also remove the JS-side filter that currently runs after the query.

**Downstream check:**
- Dashboard response shape unchanged — same fields returned.
- Frontend admin dashboard reads the same data.

**Verify:**
1. Parse 122/122
2. Dashboard loads correctly with low-stock items displayed
3. Items above threshold no longer appear in the list

---

### WS-8 — Remove dead variable in `search.js` [PARALLEL-SAFE]

**Priority:** P3 — zero user impact
**Risk:** NONE
**Files touched:** 1

**Plan:**
Remove line 26 from `api/src/routes/search.js`:
```js
const term = `%${q}%`;
```
This variable is defined but never used. Prisma's `contains` + `insensitive`
mode handles the ILIKE pattern internally.

**Verify:**
1. Parse 122/122
2. Search still works (test with a query)

---

### WS-9 — Add repeat-purchase CTA to order confirmation email [PARALLEL-SAFE]

**Priority:** P1 — direct revenue driver
**Risk:** NONE — additive HTML/text in email template
**Files touched:** 1

**Problem:**
The customer order confirmation email has no call-to-action beyond
"Reply for support." The post-purchase moment is the highest-conversion
opportunity for repeat business.

**Plan:**
In `api/src/services/email.js`, in the `sendOrderConfirmation` function,
add before the closing footer div (~line 146):

```html
<!-- Continue Shopping CTA -->
<div style="text-align:center;padding:24px 0 16px 0;">
  <a href="${siteUrl}/shop"
     style="display:inline-block;padding:14px 40px;background:#6A0E0E;color:#E8E5DD;
            text-decoration:none;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
    Continue Shopping
  </a>
</div>
```

Where `siteUrl` is:
```js
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://antivaxxer.com';
```
(Add this variable at the top of the function if not already present.)

Also add a plain-text equivalent:
```
Continue shopping: ${siteUrl}/shop
```

**Downstream check:**
- No API changes.
- No data changes.
- Only the email HTML/text body changes.

**Verify:**
1. Parse 122/122
2. `siteUrl` variable is defined in the function scope
3. Email template includes the CTA link with correct URL

---

### WS-10 — Add first-purchase incentive to welcome email [PARALLEL-SAFE]

**Priority:** P1 — converts signups into buyers
**Risk:** NONE — additive text in email template
**Files touched:** 1

**Problem:**
Welcome email says "Your account is live" but gives no reason to buy now.

**Plan:**
In `sendWelcomeEmail`, add a promo code callout below the account
confirmation text (~line 647):

```html
<div style="text-align:center;padding:16px 0 24px 0;border-top:1px solid #2C2F33;margin-top:24px;">
  <p style="color:#888;font-size:12px;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px 0;">
    Your first-order code
  </p>
  <p style="font-size:24px;letter-spacing:6px;color:#E8E5DD;font-weight:300;margin:0;">
    WELCOME10
  </p>
  <p style="color:#888;font-size:12px;margin:8px 0 0 0;">
    10% off your first purchase
  </p>
</div>
```

**IMPORTANT: The promo code `WELCOME10` must be created in the admin panel
before this email goes live.** Create it with:
- Code: `WELCOME10`
- Type: `percentage`
- Value: `10`
- Max uses per user: `1`
- No expiration

If the operator hasn't created the promo yet and a customer tries to use
it, the checkout will show "This promo code is not valid" — annoying but
not broken. Document this in the changelog.

**Verify:**
1. Parse 122/122
2. Promo code text appears in email template
3. Plain-text version also includes the code

---

### WS-11 — Show cart items in abandoned cart email [PARALLEL-SAFE]

**Priority:** P2 — higher recovery conversion
**Risk:** LOW — needs to handle variable cart data shapes
**Files touched:** 1

**Problem:**
The abandoned cart email says "You left something behind" with a recovery
link but doesn't show what's in the cart. The `cartData` JSON blob is
available but not rendered.

**Plan:**
In `sendAbandonedCartEmail`, parse `cart.cartData` and render a simple
item list. The cart data shape (from `CartContext.js`) is:
```js
{ variantId, productId, name, color, size, price, image, sku, qty }
```

Add item rendering:
```js
const items = Array.isArray(cart.cartData) ? cart.cartData : [];
const itemRowsHtml = items.map(item => `
  <tr>
    <td style="padding:8px;color:#E8E5DD;font-size:13px;">
      ${item.name || 'Product'}
      <br><span style="color:#888;font-size:11px;">${[item.color, item.size].filter(Boolean).join(' / ')}</span>
    </td>
    <td style="padding:8px;color:#E8E5DD;text-align:center;">${item.qty || 1}</td>
    <td style="padding:8px;color:#E8E5DD;text-align:right;">$${Number(item.price || 0).toFixed(2)}</td>
  </tr>
`).join('');
```

**CAUTION:** `cartData` is user-submitted JSON stored as-is. Defensive
coding required:
- Wrap in `Array.isArray()` check
- Default every field (`item.name || 'Product'`)
- Do NOT use `item.image` in the email (could be a malicious URL)
- Keep it simple — name, color/size, qty, price only

**Verify:**
1. Parse 122/122
2. Cart recovery email renders items when cartData is valid array
3. Cart recovery email degrades gracefully when cartData is empty or malformed
4. No user-submitted image URLs are rendered in the email

---

### WS-12 — Move `module.exports` to end of `account.js` [PARALLEL-SAFE]

**Priority:** P3 — readability only
**Risk:** NONE
**Files touched:** 1

**Plan:**
Move `module.exports = router;` from ~line 137 to the last line of the
file (after the wishlist delete route). The current placement works
because JS passes the router reference, but it's confusing.

**Verify:**
1. Parse 122/122
2. All account + wishlist routes respond correctly

---

### WS-13 — Split `loginLimiter` from `registerLimiter` on auth routes [PARALLEL-SAFE]

**Priority:** P2 — login is currently more restrictive than designed
**Risk:** MEDIUM — changes middleware mounting order
**Files touched:** 2

**Problem:**
`rateLimiter.js` defines `loginLimiter` (10 req / 15 min) and
`registerLimiter` (5 req / 1 hr). But `index.js` mounts the entire
`/api/auth` path under `registerLimiter`, meaning login attempts are
limited to 5/hour instead of the intended 10/15min.

**Plan:**

Step 1 — In `api/src/index.js`, change the auth route mounting from:
```js
app.use('/api/auth', registerLimiter, turnstileVerify, require('./routes/auth'));
```

To path-specific limiters. Two approaches:

**Option A — Split at index.js level (preferred):**
```js
const authRouter = require('./routes/auth');
app.use('/api/auth/login', loginLimiter, turnstileVerify, authRouter);
app.use('/api/auth/register', registerLimiter, turnstileVerify, authRouter);
app.use('/api/auth/forgot-password', registerLimiter, authRouter);
app.use('/api/auth/reset-password', authRouter); // no rate limit (token is the auth)
```

**Option B — Apply limiters inside auth.js per-route:**
```js
// In auth.js:
router.post('/login', loginLimiter, validate(loginBody, 'body'), async (req, res, next) => { ... });
router.post('/register', registerLimiter, validate(registerBody, 'body'), async (req, res, next) => { ... });
```

Option B is cleaner because it keeps rate-limit decisions close to
the routes they protect. But it requires importing `loginLimiter` into
`auth.js` (currently only imported in `index.js`).

**CRITICAL: Turnstile verification must remain on login AND register
but NOT on forgot-password or reset-password.** Users who forgot their
password may not be able to complete a Turnstile challenge if their
session is corrupted. Verify the Turnstile middleware is applied
correctly after the split.

Step 2 — Update the `loginLimiter` import in `index.js`:
```js
const { adminLimiter, checkoutLimiter, registerLimiter, loginLimiter } = require('./middleware/rateLimiter');
```

**Downstream check:**
- Frontend login form must still handle 429 (rate limited) responses.
  Check `frontend/src/app/account/login/page.js` for error handling.
- Frontend register form — same check.
- Turnstile widget must still appear on login AND register forms.

**Verify:**
1. Parse 122/122
2. Login works normally
3. After 10 rapid login attempts, get 429 (not after 5)
4. After 5 rapid register attempts, get 429
5. Forgot-password is NOT rate limited by loginLimiter
6. Turnstile still appears on login and register forms

---

### WS-14 — Handle `www` subdomain in CORS [PARALLEL-SAFE]

**Priority:** P1 — prevents subtle production bug
**Risk:** LOW — additive CORS config
**Files touched:** 1

**Problem:**
CORS origin is set to `process.env.NEXTAUTH_URL` which is
`https://antivaxxer.com`. Requests from `https://www.antivaxxer.com`
would be blocked by CORS.

**Plan:**
In `api/src/index.js`, change the CORS config from:
```js
cors({
  origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
  credentials: true,
})
```
to:
```js
cors({
  origin: function (origin, callback) {
    const allowed = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    // Allow the configured origin + www variant + no-origin (server-to-server)
    if (!origin || origin === allowed || origin === allowed.replace('://', '://www.')) {
      callback(null, true);
    } else {
      callback(new Error('CORS: origin not allowed'));
    }
  },
  credentials: true,
})
```

**Alternative (simpler):** Configure DNS to redirect `www.antivaxxer.com`
→ `antivaxxer.com` at the DNS/CDN level. Then CORS doesn't need to
handle both. This is the standard approach and is already implied by
the Amplify/Vercel domain setup in the runbooks. If the redirect is
confirmed in place, this CORS change becomes unnecessary.

**Recommendation:** Verify the DNS redirect first. If it exists, skip
this item. If it doesn't, implement the CORS change.

**Verify:**
1. Parse 122/122
2. API responds to requests from `https://antivaxxer.com` (200)
3. API responds to requests from `https://www.antivaxxer.com` (200)
4. API rejects requests from `https://evil.com` (CORS error)

---

### WS-15 — Extract `userId` from JWT in promo validation [POST-LAUNCH]

**Priority:** P3 — low-impact information leakage
**Risk:** LOW — but changes the API contract (body → header)
**Files touched:** 2 (API + frontend)

**Problem:**
`POST /api/promos/validate` reads `userId` from the request body
(client-submitted, not JWT-verified). A user could submit another
user's ID to check promo availability.

**Why post-launch:** The impact is read-only (no data modification),
and the checkout re-validates with JWT-extracted userId anyway. This
is an information-leakage fix, not a security vulnerability.

**Plan:**
In `api/src/routes/promos.js`, add optional JWT extraction (same
pattern as `extractOptionalUserId` in checkout.js):
```js
const userId = extractOptionalUserId(req);
```
Remove `userId` from the destructured body.

In `frontend/src/app/checkout/page.js`, remove `userId` from the
promo validation fetch body (~line 170).

**Downstream check:**
- Frontend sends auth header (already does for checkout — verify it
  does for promo validation too).
- If user is not logged in, `userId` is null — per-user limit check
  is skipped (existing behavior preserved).

**Verify:**
1. Parse 122/122
2. Promo validation works for logged-in users
3. Promo validation works for guest users
4. Per-user limit still enforced for logged-in users

---

## Developer assignment (2-person team)

**Developer A (API focus):**
WS-1 (API half) → WS-2 → WS-3 → WS-4 → WS-7 → WS-8 → WS-13 → WS-14

**Developer B (Frontend + Email focus):**
WS-1 (frontend half, after A completes API) → WS-5 → WS-6 → WS-9 → WS-10 → WS-11 → WS-12

**Sync points:**
1. After WS-1 — both developers verify the API response + frontend together
2. After WS-6 Batch 4 — both developers verify checkout flow together
3. After all items — full regression + parse validation

**WS-15 deferred to post-launch.**

---

## Version and release plan

All 14 items (WS-1 through WS-14) ship as **v5.6.0**. This is a single
semver minor bump because:
- No database migrations
- No new env vars required (WS-3 makes an existing one actually work)
- No breaking API changes (WS-1 and WS-2 add fields, don't remove them)
- One admin action required (WS-10: create WELCOME10 promo code)

**WS-15 ships separately as v5.6.1 post-launch** because it changes the
promo validation API contract.

---

## Validation checklist (run after all items complete)

- [ ] Parse: 122/122 (or 122+N if new files were added)
- [ ] `grep -rn "stockQty" frontend/src/` — zero hits
- [ ] `grep -rn "<img " frontend/src/` — zero hits
- [ ] All API responses for `/api/products` and `/api/products/:slug`
      include `inStock` boolean, do NOT include `stockQty`
- [ ] Checkout with promo code works (logged in + guest)
- [ ] Checkout without promo code works
- [ ] Order confirmation email includes "Continue Shopping" CTA
- [ ] Welcome email includes WELCOME10 promo code
- [ ] Admin dashboard loads correctly
- [ ] Login rate limit is 10/15min (not 5/hr)
- [ ] Product detail page shows correct "In Stock" / "Out of Stock"
- [ ] All images lazy-load below the fold

---

## Rollback

Each item is one commit. To rollback any single item:
```bash
git revert <commit-hash>
```

To rollback everything:
```bash
git revert HEAD~14..HEAD   # reverts all 14 commits
```

Or restore from `antivaxxer-v5.5.5-final.zip` — the verified baseline.
