# ANTIVAXXER — Site Workflow Specification

**Version:** 5.4.7
**Last verified against code:** v5.4.7 build — full regression scan completed, pre-launch operator tasks consolidated to PRE_LAUNCH_CHECKLIST.md
**Audience:** Developer inheriting or extending this codebase; ops team understanding operational flows

This document describes how every major feature of the ANTIVAXXER e-commerce site works today, what's partially built, and what's designed but not yet implemented. It's intentionally exhaustive — a new developer should be able to read this and immediately understand the full system without reverse-engineering the code.

**Legend used throughout:**
- ✅ **BUILT** — verified in code, works in production
- 🟡 **PARTIAL** — scaffolding exists but something is missing
- 🔴 **NOT BUILT / DESIGN TARGET** — planned but not built; spec only
- ⛔ **DEFERRED** — intentionally out of scope for launch

> **Note on accuracy** (added v5.3.5): A spec audit found several sections claiming features were "BUILT" when only the API existed and the frontend page didn't (notably admin dashboard, promo management UI, customer management). All such claims have been corrected. If you find any remaining "BUILT" claim that doesn't match reality, treat the code as the source of truth and update this doc.

---

## Table of Contents

1. [System Architecture Overview](#1-system-architecture-overview)
2. [User Account Flows](#2-user-account-flows)
3. [Shopping Flows](#3-shopping-flows)
4. [Wishlist Flow](#4-wishlist-flow)
5. [Checkout Flow](#5-checkout-flow)
6. [Stripe Payment Flow](#6-stripe-payment-flow)
7. [Order Management & Fulfillment (Stripe → Shippo → Ops)](#7-order-management--fulfillment)
8. [Admin Flows](#8-admin-flows)
9. [Email Notifications — Three Touchpoints](#9-email-notifications)
10. [Background Jobs & Cron](#10-background-jobs--cron)
11. [Data Model Reference](#11-data-model-reference)
12. [API Endpoint Reference](#12-api-endpoint-reference)
13. [Integration Points](#13-integration-points)
14. [Feature Gap List & Roadmap](#14-feature-gap-list)

---

## 1. System Architecture Overview

### High-level components

```
┌─────────────────────────────────────────────────────────────────┐
│                          CUSTOMER                                │
│              (Browser — Desktop or Mobile)                       │
└─────────────────┬───────────────────────────────┬───────────────┘
                  │                               │
                  │ HTTPS                         │ HTTPS
                  ▼                               ▼
        ┌──────────────────┐         ┌────────────────────┐
        │  AWS Amplify     │         │  AWS App Runner    │
        │  (Next.js 15)    │◄────────│  (Express API)     │
        │                  │  API    │                    │
        │  - SSR pages     │  calls  │  - REST endpoints  │
        │  - SEO meta      │         │  - Auth middleware │
        │  - Static assets │         │  - Prisma ORM      │
        └──────────────────┘         └────────┬───────────┘
                                              │
                      ┌───────────────────────┼──────────────────┐
                      │                       │                  │
                      ▼                       ▼                  ▼
              ┌──────────────┐       ┌──────────────┐   ┌──────────────┐
              │  RDS         │       │     S3       │   │    SES       │
              │  PostgreSQL  │       │  (images)    │   │  (email)     │
              │  (15 models) │       │              │   │              │
              └──────────────┘       └──────┬───────┘   └──────────────┘
                                            │
                                            ▼
                                     ┌──────────────┐
                                     │  CloudFront  │
                                     │  (image CDN) │
                                     └──────────────┘

        External integrations:
        ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────────┐
        │  Stripe  │  │  Shippo  │  │ Mailchimp │  │  Turnstile   │
        │(payments)│  │(shipping)│  │(newsletter)│  │(bot protect) │
        └──────────┘  └──────────┘  └──────────┘  └──────────────┘
           ✅            🔴              ✅              ✅
```

### Request flow for a typical page load

1. Customer visits `https://antivaxxer.com/shop/definition-tee`
2. Amplify CloudFront edge serves the Next.js page (pre-rendered or SSR)
3. Next.js client fetches `GET /api/products/definition-tee` from App Runner
4. App Runner Express API queries RDS via Prisma, returns product JSON
5. Next.js renders the page, client hydrates interactive components
6. Product images served directly from CloudFront (cached)

### Request flow for a purchase

1. Customer clicks "Add to Cart" → cart state updated in React context + localStorage
2. Customer clicks "Checkout" → navigated to `/checkout`
3. Checkout form posts to `POST /api/checkout` → creates pending Order + Stripe PaymentIntent
4. Stripe.js handles card entry client-side (PCI compliance)
5. Stripe confirms payment → sends webhook to `POST /api/webhooks/stripe`
6. Webhook handler updates Order status `pending` → `paid`, deducts inventory, sends confirmation email
7. Customer sees confirmation page

---

## 2. User Account Flows

### 2.1 Guest browsing ✅ BUILT

**No account required to:**
- Browse product grid (`/`)
- View category listings (`/shop?category=tees`)
- View individual product pages (`/shop/definition-tee`)
- Open product quick-view modal
- Search products (`/search`)
- Read About, FAQ, Resources pages
- Subscribe to newsletter
- Add items to cart
- Add items to wishlist (stored in localStorage)
- Complete checkout as guest

**Cart and wishlist persistence for guests:**
- Cart: stored in `localStorage` under `antivaxxer_cart`, survives page reloads and tab closes, cleared after successful checkout
- Wishlist: stored in `localStorage` under `antivaxxer_wishlist_guest`, survives page reloads, **merged into account on sign-in** (union, no data loss)

### 2.2 User registration ✅ BUILT

**Endpoint:** `POST /api/auth/register`

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "at-least-8-chars",
  "firstName": "First",
  "lastName": "Last"
}
```

**Backend flow:**
1. Validate input shape with Zod (`registerBody` validator)
2. Check if email already exists → 409 Conflict if so
3. Hash password with bcrypt (cost factor 10)
4. Create `User` record with `role='customer'`
5. Sign JWT with `{ userId, email, role }` payload using `NEXTAUTH_SECRET`
6. Return `{ user, token }` — the token is the `apiToken` the frontend uses for authenticated requests

**Frontend flow:**
1. User submits form at `/account/register`
2. Frontend POSTs to the API endpoint
3. On success, the returned token is stored in the NextAuth session
4. User is redirected to `/account`

**Edge cases handled:**
- Duplicate email → friendly error message
- Password too short → validation error before API call
- Server error → generic "Something went wrong" with retry

**What happens to existing guest data on register:**
- Cart: **not automatically migrated** — the cart stays in localStorage, user sees their items still in the cart after signing in (the cart context reads localStorage regardless of login state)
- Wishlist: **automatically merged** on first authenticated API call via `WishlistContext` hydration — guest items are POSTed to `/api/account/wishlist` and localStorage is cleared

### 2.3 User login ✅ BUILT

**Endpoint:** `POST /api/auth/login`

**Request body:**
```json
{
  "email": "user@example.com",
  "password": "password"
}
```

**Backend flow:**
1. Look up user by email
2. Compare password hash with bcrypt
3. If valid: sign JWT, return `{ user, token }`
4. If invalid: return 401 with generic message (don't leak whether email exists)

**Frontend flow (NextAuth):**
1. User submits form at `/account/login`
2. NextAuth CredentialsProvider calls the API endpoint
3. NextAuth creates a session with the returned `apiToken` embedded
4. User is redirected to `/account` (or the original destination if `?next=` param was set)

**Session persistence:**
- NextAuth uses JWT strategy with a 30-day session
- Session cookie is httpOnly, secure, SameSite=lax
- `NEXTAUTH_SECRET` signs both the session cookie and the API JWT (single secret for simplicity)

### 2.4 Password reset ✅ BUILT (v5.3.5)

**Status:** Fully built end-to-end in v5.3.5.

**Schema fields** (added in migration `20260414000000_add_password_reset`):
- `users.reset_token_hash` — VARCHAR(64), indexed. Stores SHA-256 of the raw token. The raw token is **never** stored in the database — it only ever lives in the email URL.
- `users.reset_token_expires_at` — TIMESTAMP. 1-hour TTL set when the token is issued.

**Frontend pages:**
- `/account/forgot-password` — email input, posts to backend, shows generic "CHECK YOUR EMAIL" success regardless of whether the email is registered (anti-enumeration).
- `/account/reset-password/[token]` — reads token from URL via `useParams`, two password inputs (new + confirm), client-side validation (min 8 chars, must match), posts to backend. Expired/invalid tokens show a clear error with a "Request a new link" CTA.
- `/account/login` — has a "Forgot password?" link below the password field.

**Backend endpoints** (`api/src/routes/auth.js`):
1. `POST /api/auth/forgot-password` with `{ email }`
   - Generates 32 random bytes (`crypto.randomBytes`), hex-encoded
   - Hashes with SHA-256, stores hash + 1-hour expiry on user row
   - Calls `sendPasswordResetEmail` with the raw token in the URL
   - **Always returns HTTP 200** with a generic message — never reveals whether the email is registered
   - Re-requesting overwrites the previous token (effectively invalidates the previous email)

2. `POST /api/auth/reset-password` with `{ token, password }`
   - Hashes the submitted token with SHA-256, looks up user by hash (uses the index)
   - Verifies expiry — clears expired tokens to prevent retry
   - Hashes new password with bcrypt cost 12
   - Clears `resetTokenHash` and `resetTokenExpiresAt` on success
   - Returns success message; user is sent to login page (does NOT auto-login on reset)

**Email template:**
- `sendPasswordResetEmail({ email, name, resetUrl })` in `api/src/services/email.js`
- HTML + text body, brand styled, 1-hour expiry messaging
- Sent via AWS SES from `SES_FROM_EMAIL`

**Required env vars:**
- `NEXT_PUBLIC_SITE_URL` — used to build the reset link in the email (e.g. `https://antivaxxer.com`)
- `SES_FROM_EMAIL` — verified SES sender

### 2.5 Account page ✅ BUILT

**Route:** `/account`

**Shows:**
- User's name and email
- Navigation to Orders, Wishlist, Settings (stub)
- Log out button

**Protected by NextAuth — redirects to `/account/login` if not authenticated.**

### 2.6 Order history ✅ BUILT

**Route:** `/account/orders` (list) and `/account/orders/[id]` (detail)

**Frontend:** fetches `GET /api/account/orders` with `Authorization: Bearer ${apiToken}`

**API flow:**
1. JWT verification middleware extracts `userId`
2. `prisma.order.findMany({ where: { userId }, include: { items: {...} } })`
3. Returns orders sorted by createdAt desc

**Order detail page shows:**
- Order number, date, status
- Item list with thumbnails, size, color, quantity, price
- Shipping address (frozen snapshot from order time)
- Totals (subtotal, discount, shipping, tax, total)
- Tracking number + carrier link if shipped

### 2.7 Wishlist page ✅ BUILT

**Route:** `/account/wishlist`

**Frontend flow:**
1. Fetches `GET /api/account/wishlist`
2. Displays saved products as a grid
3. "Remove" button calls `DELETE /api/account/wishlist/:productId`
4. "Move to Cart" adds to cart and removes from wishlist (client-side only)

**See section 4 for full wishlist flow including guest/login merge.**

---

## 3. Shopping Flows

### 3.1 Homepage ✅ BUILT

**Route:** `/`

**Composition (top to bottom):**
1. `AnnouncementBar` — red strip with "FREE SHIPPING OVER $75"
2. `Header` with logo, nav, search/wishlist/account/cart icons
3. `SocialFloatBar` — fixed left sidebar (IG, X, TikTok, Facebook)
4. `HeroSection` — full-viewport animated logo + tagline + "SHOP THE COLLECTION" CTA
5. `MarqueeTicker` — scrolling brand values ("FREE THINKER APPROVED", etc.)
6. `FeaturedBanner` — "THE BRAND THAT FIGHTS BACK"
7. Product grid (all featured products, category filters above)
8. `QuotesSection` — 4 customer quote cards
9. `WornByMovementSection` — Definition Tee hero + dual CTAs (shop + resources)
10. `ReviewsSection` — 4 star-rated reviews
11. `NewsletterSection` — email capture
12. `Footer` — 4-column grid with shop/info/legal/social links
13. `PromoPopup` — 2-second delayed modal with FREEDOM15 code

**Quick-view modal flow:**
- User hovers product card → "QUICK ADD" button slides up from bottom of image
- Click → opens centered 960px modal with image, size/color selectors, add-to-cart, wishlist heart
- Click outside or ESC → closes

### 3.2 Product listing & filtering ✅ BUILT

**Route:** `/shop` or `/shop?category=tees`

**API:** `GET /api/products?category=slug&limit=20&offset=0`

**Filters supported:**
- Category (via query param)
- Search (routes to `/search`)
- Sort by: relevance, price ascending, price descending (client-side)

**Pagination:** offset-based, 20 per page default.

**Gap:** no faceted filtering (color, size, price range). Deferred.

### 3.3 Search ✅ BUILT

**Route:** `/search?q=...`

**API:** `GET /api/search?q=term`

**Implementation:** PostgreSQL `ILIKE` match against product name, description, and variant label. Returns ranked results.

**Gap:** Not using `pg_trgm` for fuzzy matching or typo tolerance. Search for "definiton tee" (typo) returns nothing. Could be upgraded later.

### 3.4 Product detail page ✅ BUILT

**Route:** `/shop/[slug]`

**Components:**
- Breadcrumb: Home › Shop › Category › Product Name
- Image gallery (variant-specific — switches when color is changed)
- Product name, price, description, variant label
- Size selector (44×44 touch targets)
- Color selector (28×28 round swatches)
- Add to Cart button (branches by product status — see below)
- Wishlist button (top-left of image area)
- JSON-LD structured data for SEO (Product + Breadcrumb)

**Per-variant images:** If a product has images tagged with a specific color ID, selecting that color filters the gallery to just those images. If no color-tagged images exist, all images show.

**Product status handling (v5.3.7):**

The PDP buy button branches on `product.status`:

| Status | PDP Behavior | Card Behavior |
|---|---|---|
| `active` | Normal "Add to Cart — $XX" button | Standard QUICK ADD overlay |
| `coming_soon` | Non-clickable blue "Coming Soon" placeholder. "In Stock" line hidden. | Blue "COMING SOON" badge. NO Quick Add overlay (purchase path entirely disabled). |
| `prelaunch` | Red "Pre-Order — $XX" button (still adds to cart). "In Stock" line replaced with "Pre-Order — ships at launch". | Purple "PRE-ORDER" badge. Quick Add overlay relabeled "PRE-ORDER" (still adds to cart). |
| `draft`/`archived` | Not returned by public API — never reaches the PDP | — |

The status badge always takes priority over the manual `badge` field. A `coming_soon` product with a "NEW" admin badge will still show "COMING SOON" on the card.

### 3.5 Cart operations ✅ BUILT

**Cart state lives in:**
- React Context (`CartContext`) — source of truth while page is active
- localStorage (`antivaxxer_cart`) — persists across reloads

**Cart operations:**
- `addItem({ variantId, productId, name, color, size, price, image, sku })` — adds new line or increments quantity if matching variantId exists
- `updateQty(variantId, qty)` — sets quantity; removes line if qty ≤ 0
- `removeItem(variantId)` — removes line entirely
- `clearCart()` — empties cart (called on successful checkout)
- `cartTotal` — computed from line items
- `cartCount` — sum of all line quantities

**Cart drawer:**
- Slides in from right (460px wide)
- Shows all items with thumbnail, name, color/size, qty +/- controls, remove button
- Shipping progress bar: "$X.XX away from free shipping" or "Free shipping!" if ≥ $75
- Checkout button routes to `/checkout`

**Cart persistence across login:** The cart context reads localStorage regardless of login state, so items survive signing in without any merge logic.

---

## 4. Wishlist Flow ✅ BUILT (v5.3.3)

### 4.1 The key design decision

Wishlists use **optimistic save with localStorage persistence for guests**. The heart fills immediately on tap regardless of login state. No friction, no blocking login prompt, no lost items.

### 4.2 Guest user flow

1. User taps heart icon on product card, modal, or detail page
2. `WishlistContext.toggleWishlist(productId)` is called
3. `wishlistIds` Set updates optimistically — heart fills red immediately
4. New Set is written to localStorage under key `antivaxxer_wishlist_guest`
5. If this is the first wishlist add in the session, a `WishlistPrompt` bottom sheet appears
6. Prompt message: "Saved to wishlist — Create an account to sync your favorites across devices"
7. Prompt has two CTAs: "Create Account" (primary red) and "Sign In" (secondary outlined)
8. Prompt auto-dismisses after 6 seconds
9. Prompt shows once per session (tracked via `sessionStorage`)

### 4.3 Logged-in user flow

1. User taps heart icon
2. `toggleWishlist` optimistically updates the context's `wishlistIds` Set
3. Background API call: `POST /api/account/wishlist/:productId` with `Authorization: Bearer ${apiToken}`
4. If API call fails, the heart stays filled locally (UI is never broken by network errors)
5. **No prompt shows** for logged-in users

### 4.4 Merge-on-login flow (the critical path)

When a guest user signs in and already has items in their local wishlist:

1. `WishlistContext` hydrates after `useSession()` resolves to `authenticated`
2. Fetches current server wishlist via `GET /api/account/wishlist`
3. Reads local wishlist from localStorage
4. Computes union: `new Set([...serverIds, ...localIds])`
5. For each local ID NOT already on server: `POST /api/account/wishlist/:productId` (bulk sync)
6. Clears localStorage `antivaxxer_wishlist_guest` after successful sync
7. Updates context to show unified state

**Why union, not replace:** Users who have saved items on multiple browsers or devices must never lose their saves. A replace-semantics merge would silently destroy data. Union is the only safe choice.

### 4.5 Sign-out flow

1. NextAuth session is cleared
2. `WishlistContext` detects `status === 'unauthenticated'`
3. Server state is dropped from context
4. localStorage is **preserved** — if the user signs in again later in the same browser, their items come back

### 4.6 Wishlist page (account)

`/account/wishlist` — fetches saved items from server, displays as a grid. "Remove" button calls `DELETE /api/account/wishlist/:productId`. Guest users who navigate here directly see an empty state with a "Sign in" CTA.

### 4.7 Header badge

Wishlist heart icon in header shows a count badge when `wishlistCount > 0`. Heart fills red when there are items. Updates in real-time across pages because `WishlistContext` is a top-level provider.

### 4.8 Wishlist API endpoints

| Method | Endpoint | Auth | Purpose |
|--------|----------|------|---------|
| GET | `/api/account/wishlist` | JWT required | Fetch user's saved products |
| POST | `/api/account/wishlist/:productId` | JWT required | Add product to wishlist |
| DELETE | `/api/account/wishlist/:productId` | JWT required | Remove product from wishlist |

All three return 401 if JWT is missing or invalid.

---

## 5. Checkout Flow

### 5.1 Checkout page ✅ BUILT

**Route:** `/checkout`

**Displays:**
- Order summary (items from cart)
- Shipping address form (required)
- Billing address form (with "same as shipping" checkbox)
- Promo code input
- Payment element (Stripe Elements, card entry happens client-side)
- Order totals: subtotal, discount, shipping, tax, total
- Place Order button

**Guest vs logged-in:**
- Logged-in users see pre-filled email from their account
- Guest users enter email inline — an order is still created against `userId: null`
- Both paths work identically downstream

### 5.2 Order creation flow ✅ BUILT

**Endpoint:** `POST /api/checkout`

**Request body:**
```json
{
  "items": [{ "variantId": "uuid", "quantity": 2 }],
  "email": "customer@example.com",
  "shippingAddress": { "line1", "city", "state", "zip", ... },
  "billingAddress": { ... },
  "promoCode": "FREEDOM15"
}
```

**Backend flow:**
1. **Validate input** with Zod
2. **Fetch variants** from DB, verify all exist and have sufficient stock
3. **Re-compute price server-side** — never trust client-sent prices (prevents tampering)
4. **Apply promo code** if provided — look up in PromoCode table, validate active/not expired/not over usage limit, compute discount
5. **Calculate shipping** — currently flat-rate table based on cart subtotal (free over $75, $8 otherwise)
6. **Calculate tax** — currently $0 (see gap below)
7. **Create Order record** with `status='pending'` and all line items as OrderItem records
8. **Create Stripe PaymentIntent** with amount in cents, metadata `{ orderId, orderNumber }`
9. **Return** `{ orderId, orderNumber, clientSecret }` to the frontend

**Frontend then:**
1. Uses the `clientSecret` to confirm the PaymentIntent via Stripe Elements
2. Stripe handles 3D Secure authentication inline if the card requires it
3. On success, Stripe sends a webhook to the API (see section 6)
4. Frontend redirects to `/checkout/confirmation?order=${orderNumber}`

**Gap — Stripe Tax:** Stripe has an automatic tax calculation feature that can be enabled with a one-line change to the PaymentIntent creation (`automatic_tax: { enabled: true }`). This isn't wired yet because it requires Stripe Tax to be enabled in the dashboard and tax registrations to be configured for applicable states. Documented in section 14.

### 5.3 Guest checkout ✅ BUILT

Guest checkout works identically to logged-in checkout at the API level. The `Order.userId` is set to `null`. The order is still retrievable by order number and email for customer service purposes.

**Guest users cannot view their orders later** unless they create an account with the same email (even then, there's no automatic migration of historical orders — this is a gap).

**Gap — Guest order lookup:** Common pattern is `/orders/lookup` page where a guest enters order number + email to view the order. Not built.

### 5.4 Abandoned cart flow ✅ BUILT

**When it fires:**
1. A user enters their email on the checkout page (before completing payment)
2. Frontend POSTs to `/api/cart/save` with the cart contents + email
3. API creates an `AbandonedCart` record with a unique recovery token
4. If the user completes checkout within the grace period, the cart is marked recovered
5. If they don't, the cron job (see section 10) will email them a recovery link

**Recovery email:**
- Subject: "Still thinking it over?"
- Body: product thumbnails with names and prices
- CTA: "Continue Your Order" → `/cart/recover/:token`

**Recovery page flow:**
1. User clicks link in email
2. Frontend calls `GET /api/cart/recover/:token`
3. API returns cart contents + marks cart as "recovered" (prevents duplicate emails)
4. Frontend hydrates the cart context and redirects to `/checkout`

**Configuration:**
- `ABANDONED_CART_DELAY_MS` — how long to wait before sending (default 1 hour)
- `RECOVERY_TOKEN_EXPIRY` — how long the recovery link works (default 7 days)

---

## 6. Stripe Payment Flow

### 6.1 Payment sequence ✅ BUILT

```
Customer                  Frontend            API                  Stripe
   │                         │                 │                      │
   │  1. Click "Place Order" │                 │                      │
   ├────────────────────────►│                 │                      │
   │                         │  2. POST /api/checkout                 │
   │                         ├────────────────►│                      │
   │                         │                 │  3. Create Order     │
   │                         │                 │     (status=pending) │
   │                         │                 │                      │
   │                         │                 │  4. PaymentIntent    │
   │                         │                 ├─────────────────────►│
   │                         │                 │◄─────────────────────┤
   │                         │                 │    clientSecret      │
   │                         │◄────────────────┤                      │
   │                         │  5. clientSecret│                      │
   │                         │                 │                      │
   │                         │  6. stripe.confirmPayment(card)        │
   │                         ├────────────────────────────────────────►
   │                         │                 │                      │
   │                         │  7. 3D Secure (if required)            │
   │◄────────────────────────┤                 │                      │
   │  Customer authenticates │                 │                      │
   ├────────────────────────►│                 │                      │
   │                         │                 │                      │
   │                         │◄────────────────────────────────────────┤
   │                         │  8. Success     │                      │
   │                         │                 │                      │
   │                         │                 │◄─────────────────────┤
   │                         │                 │  9. Webhook:         │
   │                         │                 │  payment_intent.     │
   │                         │                 │  succeeded           │
   │                         │                 │                      │
   │                         │                 │ 10. Update Order     │
   │                         │                 │     status=paid      │
   │                         │                 │     Deduct inventory │
   │                         │                 │     Send emails      │
   │                         │                 │                      │
   │◄────────────────────────┤                 │                      │
   │ 11. Redirect to         │                 │                      │
   │     /checkout/confirmation                │                      │
```

### 6.2 Webhook handler ✅ BUILT

**Endpoint:** `POST /api/webhooks/stripe`

**Critical implementation detail:** this route MUST be mounted BEFORE `express.json()` because Stripe webhook signature verification requires the raw request body. The current codebase handles this correctly in `api/src/index.js`.

**Events handled:**
- `payment_intent.succeeded` — update order to `paid`, deduct inventory, send emails
- `payment_intent.payment_failed` — log the failure, keep order as `pending` for retry

**Signature verification:**
```javascript
const sig = req.headers['stripe-signature'];
const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
```
If verification fails, return 400 and don't process. This prevents webhook spoofing.

### 6.3 Idempotency ✅ BUILT

The webhook checks `if (order.status !== 'pending')` before processing. If Stripe sends the same event twice (which they do retry on failure), the second delivery is a no-op. The order can only transition from `pending` → `paid` once.

### 6.4 Inventory deduction ✅ BUILT

On successful payment:
1. For each line item in the order, decrement `Variant.stockQty` by the ordered quantity
2. If a variant's stock would go negative, log a warning but continue (edge case: two orders hit simultaneously — last one wins, oversell is handled by admin manually)
3. Call `checkInventoryLevels(purchasedItems)` to trigger low-stock alerts if any variant crosses thresholds

**Gap — Race condition:** Simultaneous orders for the same variant with low stock can oversell. The proper fix is to use a Prisma transaction with a row lock. Not critical at launch scale but should be fixed before high-volume sales. Documented in section 14.

### 6.5 Post-payment email sends ✅ BUILT

After the order is marked `paid`:
1. `sendOrderConfirmation(order)` — sends to customer
2. Inventory alert triggered if thresholds crossed — sent to ops

**Gap — Per-order email to ops:** Not yet built. See section 9.

---

## 7. Order Management & Fulfillment

### 7.1 Current fulfillment flow ✅ BUILT (manual)

1. Customer places order → webhook marks `paid`
2. Admin sees new order in `/admin/orders` with status "paid"
3. Admin manually processes the order: picks items, packs them, generates a shipping label (currently outside the system)
4. Admin updates order status via `PUT /api/admin/orders/:id/status` with `status='shipped'` and `trackingNumber`
5. Customer gets email notification (not yet built — see gap)

**The admin interface at `/admin/orders/[id]` supports:**
- Updating status through the transitions: `pending → paid → processing → shipped → delivered`
- Entering tracking number and tracking URL
- Adding internal notes
- Sending manual emails (not wired)

### 7.2 Shippo integration ✅ BUILT (v5.4.0)

**Status:** Fully built. Service file, admin endpoints, tracking webhook, frontend rate selection + label purchase UI, schema migration.

**Flow:** admin-initiated (not auto-triggered by Stripe webhook). The design goal of "auto-label on payment" was changed to "admin selects carrier/rate and clicks Purchase" because:
1. Admins may want to batch labels at specific times of day
2. Some orders need custom packaging or split shipments
3. Rate selection lets admin pick economy vs priority based on urgency

### 7.3 Shippo workflow ✅ BUILT (v5.4.0)

```
Payment succeeds (Stripe webhook)
        │
        ▼
Order status → processing (automatic, v5.3.7)
Inventory deducted (atomic transaction, v5.3.9)
Ops fulfillment email sent (v5.3.8)
        │
        ▼  (admin goes to /admin/orders/[id])
┌────────────────────┐
│ 1. "Get Shipping   │     Calls POST /api/admin/orders/:id/shipment
│    Rates" button   │──►  Creates Shippo shipment, returns rates
└────────────────────┘
        │
        ▼
┌────────────────────┐
│ 2. Admin selects   │     Rate cards show carrier, service, price,
│    a rate          │     estimated delivery days
└────────────────────┘
        │
        ▼
┌────────────────────┐
│ 3. "Purchase       │     Calls POST /api/admin/orders/:id/label
│    Label" button   │──►  Calls Shippo transaction API
└────────────────────┘
        │
        ▼
┌────────────────────┐
│ 4. Order updated:  │     - status → shipped
│    - label URL     │     - shippedAt timestamp set
│    - tracking #    │     - carrier + service saved
│    - carrier info  │     - audit note appended
└────────────────────┘
        │
        ▼
Label PDF downloadable from /admin/orders/[id]
Tracking link clickable → carrier tracking page
        │
        ▼  (Shippo sends tracking updates to webhook)
┌────────────────────┐
│ 5. DELIVERED event │     POST /api/webhooks/shippo
│    from carrier    │──►  status → delivered, deliveredAt set
└────────────────────┘
```

### 7.4 Shippo data model ✅ BUILT (v5.4.0)

Added to `Order` model (migration `20260415100000_add_shippo_fields`):

```prisma
shippoShipmentId      String?   @map("shippo_shipment_id") @db.VarChar(100)
shippoTransactionId   String?   @map("shippo_transaction_id") @db.VarChar(100)
carrier               String?   @db.VarChar(50)
carrierService        String?   @map("carrier_service") @db.VarChar(100)
labelUrl              String?   @map("label_url") @db.VarChar(500)
```

The existing `trackingNumber`, `trackingUrl`, `shippedAt`, `deliveredAt` fields are reused — no changes needed there.

### 7.5 Shippo API integration ✅ BUILT (v5.4.0)

**File: `api/src/services/shippo.js`** (~170 lines)

Exports:
- `createShipment(order, weightOz)` — builds a Shippo shipment from the order's shipping address and variant weights. Returns `{ shipmentId, rates }` where rates are sorted by price ascending. Uses `async: false` for synchronous rate retrieval.
- `purchaseLabel(rateId)` — purchases label for a given rate ID. Returns `{ transactionId, trackingNumber, trackingUrl, labelUrl, carrier, service }`. Validates the transaction status is `SUCCESS`.

**Admin endpoints** (`api/src/routes/admin.js`):
- `POST /api/admin/orders/:id/shipment` — validates order is in processing/paid status and has a shipping address, computes total weight from `Variant.weightOz` (defaults 8oz per item if weight not set), creates Shippo shipment, saves `shippoShipmentId` on the order, returns rates.
- `POST /api/admin/orders/:id/label` — validates `rateId` is provided and no label exists yet (prevents double-purchase), purchases label via Shippo, updates order with all shipping data + transitions to `shipped` + sets `shippedAt` + appends audit note.

**Environment variables** (new):
- `SHIPPO_API_KEY` — from Shippo dashboard → Settings → API
- `SHIPPO_FROM_NAME` — sender name (default "ANTIVAXXER")
- `SHIPPO_FROM_STREET`, `SHIPPO_FROM_CITY`, `SHIPPO_FROM_STATE`, `SHIPPO_FROM_ZIP` — sender address
- `SHIPPO_FROM_COUNTRY` — default "US"
- `SHIPPO_FROM_EMAIL` — optional, falls back to `SES_FROM_EMAIL`

### 7.6 Shippo → Order state transitions ✅ BUILT (v5.4.0)

**Webhook handler:** `POST /api/webhooks/shippo` in `api/src/routes/webhooks.js`

Configured in the Shippo dashboard → Settings → Webhooks: point to `https://api.antivaxxer.com/api/webhooks/shippo`, event `track_updated`.

Tracking status handling:

| Shippo Status | Action |
|---|---|
| `DELIVERED` | Order status → `delivered`, `deliveredAt` set, audit note appended |
| `RETURNED` | Audit note appended: "package RETURNED. Manual review needed." Order status unchanged — admin decides what to do. |
| `FAILURE` | Audit note appended: "delivery FAILURE." Order status unchanged. |
| `TRANSIT`, `PRE_TRANSIT`, `UNKNOWN` | Logged to console, no order update (informational) |

On any webhook handler error, the event is written to the `FailedWebhook` DLQ (reuses the v5.3.9 infrastructure) with `source: 'shippo'`.

**Note:** Shippo webhooks do not have a signature verification mechanism like Stripe. We validate by confirming the tracking number matches an order in the database. Unknown tracking numbers are logged and ignored.

### 7.7 Fallback for pre-Shippo ✅ BUILT (still works)

If `SHIPPO_API_KEY` is not set, the "Get Shipping Rates" button returns a 503 `SHIPPO_NOT_CONFIGURED` error. Admins can still:
- Manually enter tracking numbers in the admin order detail page
- Manually set order status to `shipped` via the status dropdown
- Generate labels through Shippo web dashboard, ShipStation, or carrier portals
- The per-order ops fulfillment email (v5.3.8) still fires with all the packing info regardless of Shippo configuration

---

## 8. Admin Flows

### 8.1 Admin authentication ✅ BUILT (frontend gate added v5.3.5)

Admins use the same login endpoint as customers. The difference is the `User.role` field — must be `'admin'`.

**Two layers of protection:**

1. **API layer** (always was built) — `api/src/middleware/adminAuth.js` is mounted on all `/api/admin/*` routes. Three auth paths, checked in order:
   1. **`CRON_TOKEN`** (highest priority) — for Lambda → API cron calls. Single shared secret in Secrets Manager. `req.adminUser = { id: 'cron', role: 'cron' }`.
   2. **`ADMIN_TOKEN`** (legacy fallback) — for bootstrap before first admin user exists. Should be removed from production env after launch.
   3. **JWT with `role='admin'`** — normal admin login path. JWT signature verified, user record fetched from DB, role re-confirmed on every single request (so a downgraded user can't keep using their old session).

   All three return 401 for missing auth and 403 for invalid/expired credentials.

2. **Frontend layer** (added in v5.3.5) — `frontend/src/app/admin/layout.js` is a server component with a hard gate:
   - Calls `getServerSession(authOptions)` on every request
   - `dynamic = 'force-dynamic'` so the check is never cached
   - Unauthenticated → `redirect('/account/login?callbackUrl=/admin')`
   - Signed in but `role !== 'admin'` → `redirect('/403')`
   - Shared `authOptions` lives in `frontend/src/lib/auth.js` so server components and the NextAuth route handler import the same config (avoids circular imports)

**Pre-v5.3.5 risk** (now fixed): the frontend layout had no auth check at all — the comment literally said "temp auth gate" but no gate existed. Anyone hitting `/admin` saw the UI structure (though the API would still refuse to return data). v5.3.5 closed this hole.

**Promoting a user to admin** (no UI yet, see Session B):
```sql
UPDATE users SET role='admin' WHERE email='you@antivaxxer.com';
```

### 8.2 Admin dashboard ✅ BUILT (v5.3.6)

**Route:** `/admin`

**Backend:** `GET /api/admin/dashboard?days=N` (default 7) returns a single consolidated payload computed in parallel via `Promise.all`:
- `stats.revenue` — sum of `total` for orders with status in `paid|processing|shipped|delivered` within the period
- `stats.orderCount` — count for the same window
- `stats.aov` — revenue / orderCount
- `stats.pendingFulfillment` — orders with status `paid` or `processing` (any age)
- `stats.lowStockCount` — variants where `stockQty <= lowStockThreshold`
- `stats.newCustomers` — users with role=customer created in the period
- `recentOrders` — last 8 orders for the dashboard table
- `lowStock` — first 10 variants below threshold (with product info)
- `topSellers` — top 5 products by units sold over the last 30 days

**Top sellers query implementation note:** the `OrderItem` model has `variantId` (not `productId`) and `unitPrice` (no precomputed `lineTotal`), so the query fetches order items via the order/variant/product joins and aggregates by productId in JS. A `groupBy productId` would not work against the actual schema.

**Frontend:**
- Six stat tiles in a 3×2 grid (mobile: 2×3)
- Top sellers list (last 30 days, ranked, with thumbnails)
- Recent orders table with status pills and click-through to `/admin/orders/:id`
- Low stock list (only renders if `lowStockCount > 0`) with click-through to `/admin/inventory`
- Red banner at the top if low stock count > 0, with a "View →" CTA to inventory

**Visual:** matches the v5.3.3 stakeholder mock — sidebar admin layout, Bebas Neue stat numbers in bone (white, with red accent for danger states), thin red borders, hover states.

### 8.3 Product CRUD ✅ BUILT

**Route:** `/admin/products` (list) and `/admin/products/[id]` (edit)

**Endpoints:**
- `GET /api/admin/products` — list all with filters
- `GET /api/admin/products/:id` — single product with variants and images
- `POST /api/admin/products` — create new
- `PUT /api/admin/products/:id` — update fields
- `PUT /api/admin/products/:id/variants` — bulk update variants (prices, stock)
- `POST /api/admin/products/:id/images` — upload new image (multipart, goes to S3)
- `DELETE /api/admin/products/:id/images/:imageId` — remove image from S3 and DB
- `PUT /api/admin/products/:id/images/reorder` — change image sort order

**Admin can update:**
- Product name, slug, description, variant label, badge
- Base price, compare price (for sale display)
- Category, featured flag, status (active/draft/archived)
- Sizes available, colors available
- Per-variant stock quantity and price override

**Image upload flow:**
1. Admin drops image on upload zone
2. Frontend POSTs multipart to `/api/admin/products/:id/images`
3. Multer parses the file buffer
4. Sharp generates 3 sizes: thumb (200px), card (600px), full (1200px) in webp
5. All uploaded to S3 under `images/products/{productId}/{size}-{hash}.webp`
6. CloudFront URLs returned and stored in `ProductImage` table

**Gap — Product creation UI:** The API supports creating new products, but the admin UI for product creation (with all the variant matrix selection) is minimal. Admins currently need to know SKU conventions and manually enter stock quantities. Could be significantly improved.

### 8.4 Inventory management ✅ BUILT (v5.3.6 added top-level view)

**Built into product edit page** (always was) — each variant row on `/admin/products/[id]` shows:
- SKU (read-only)
- Color + Size
- Stock quantity (editable)
- Price override (editable, blank means use product base price)

**Bulk update:** single API call updates all variants at once.

**Top-level inventory page** (v5.3.6 — `/admin/inventory`):
- Flattens every variant across every product into one searchable table
- Search by SKU, product name, color, size, or category
- Filter tabs: All / Low / Out (with counts)
- Color-coded stock counts (white=ok, yellow=low, red=out)
- Per-row "Edit" link to `/admin/products/:id` for inline stock editing
- Designed to be the entry point for inventory-focused admins instead of having to browse products one-by-one

**Inline editing on the inventory page itself** is not yet built — would require a new bulk-update-by-variant-id endpoint. Currently the inventory page is a read + drill-down view; actual stock edits happen on the product edit page.

**Low stock warnings in product list view:** variants with `stockQty <= REORDER_THRESHOLD` are highlighted red, variants with `stockQty <= WARNING_THRESHOLD` are highlighted yellow.

### 8.5 Order management ✅ BUILT (line item editing added v5.3.7)

**Route:** `/admin/orders` and `/admin/orders/[id]`

**List view** (built):
- Sortable by date, status, total
- Filterable by status
- Shows order number, customer name, total, status badge, date

**Detail view** (built):
- Full order info (items, address, totals, payment method last 4)
- Status transition dropdown: `pending → paid → processing → shipped → delivered`
- Tracking number + URL input (appears when status = shipped)
- Internal notes textarea (never shown to customer)
- **Line item editing (v5.3.7)** — see below

**Order state transitions:**
```
pending ──► paid ──► processing ──► shipped ──► delivered
   │         │            │             │
   ▼         ▼            ▼             ▼
cancelled  refunded   refunded      refunded
```

Admin can move orders between any status manually; the UI enforces logical transitions.

**Automated transitions:**
- `pending → processing` ✅ — Stripe webhook on `payment_intent.succeeded` (v5.3.7 changed this from `pending → paid` — the intermediate `paid` state served no purpose). The status now goes straight to `processing` so ops sees orders ready to ship as soon as payment clears.
- `processing → shipped` 🔴 NOT BUILT — Shippo integration not wired (see Section 7.2)
- `shipped → delivered` 🔴 NOT BUILT — would come from Shippo tracking webhook

**Line item editing** ✅ BUILT (v5.3.7)

Admins can now edit, add, or remove line items on any order in pending/paid/processing status. Backend refuses to edit shipped/delivered/cancelled/refunded orders (the items are physically out the door at that point).

Endpoint: `PUT /api/admin/orders/:id/items` with body `{ items: [{ variantId, quantity }] }` — full replacement model. Behavior:

1. Pre-validates stock for any added/increased items before any DB writes
2. Computes the diff against current items (added / removed / quantity changed)
3. In a single Prisma transaction:
   - Restocks removed items (`variant.stockQty += quantity`)
   - Decrements stock for added items
   - Adjusts stock by delta for quantity changes
   - Recalculates `subtotal` from updated items
   - Recalculates `total = subtotal - discount + shipping + tax` (existing discount/shipping/tax are preserved — see "What's NOT recalculated" below)
   - Appends a timestamped audit line to `order.notes` with the admin email and the full diff

Frontend (`/admin/orders/[id]`) has an "Edit Items" button that swaps the read-only items table for an editable one with quantity inputs, remove buttons, and an "+ Add Item" picker that lazy-loads the full product catalog. Live recalculation preview shows the new totals before saving. NEW badge marks added items.

**What's NOT recalculated by the line item endpoint:**
- 🔴 **Tax** — recalculating tax retroactively on an order that's already been billed creates legal/accounting problems. Admin must adjust separately via a refund or new charge.
- 🔴 **Shipping** — same reasoning. If the new items push past a free shipping threshold or change the dimensional weight, admin handles separately.
- 🔴 **Discount/promo** — preserved as-is. Re-evaluating promo eligibility on edited orders gets messy.

**Other gaps:**
- ✅ **Refund button** (v5.3.8) — issues Stripe refunds via `POST /api/admin/orders/:id/refund`. Modal UI on the order detail page with full/half quick buttons, custom amount input, optional reason textarea, double-confirmation dialog, and clear partial-vs-full warnings. Full refunds restock items and set order status to `refunded`; partial refunds preserve status and don't restock. All actions logged to `order.notes` with the Stripe refund ID and admin email.
- 🟡 **Customer link** — order detail page shows customer email but does not link through to a customer profile page yet.

### 8.6 Promo code management ✅ BUILT (v5.3.6)

**API endpoints** (`api/src/routes/admin.js`):
- `GET /api/admin/promos` — list all (with usage counts via `_count`)
- `POST /api/admin/promos` — create new
- `PUT /api/admin/promos/:id` — update any field
- `DELETE /api/admin/promos/:id` — **v5.3.6 new.** Refuses with 409 IN_USE if any usages exist (preserves order history); the UI shows the error and suggests deactivation instead.

**Promo code fields:**
- `code` — the string customers type at checkout (auto-uppercased)
- `type` — `percentage`, `fixed_amount`, or `free_shipping`
- `value` — the amount (percent or dollars)
- `minOrderAmount` — min subtotal required
- `maxUses` — cap on total redemptions (null = unlimited)
- `maxUsesPerUser` — cap per customer (null = unlimited)
- `startsAt`, `expiresAt` — validity window (both nullable)
- `isActive` — toggle without deletion

**Frontend** (`/admin/promos`):
- Table list with all fields, usage count, expiry date, active toggle (click to flip), delete button (with confirm dialog)
- Inline create form (collapsible "+ New Code" button)
- Form auto-disables the "value" field when type is `free_shipping`
- Type-aware value display: `15%`, `$10.00`, or `Free shipping`

### 8.7 Customer management ✅ BUILT (v5.3.6)

**Routes:**
- `/admin/customers` — list view
- `/admin/customers/[id]` — profile + order history

**API endpoints** (v5.3.6 new):
- `GET /api/admin/customers?search=&limit=&offset=` — paginated list with case-insensitive search by name or email. Returns aggregated `orderCount` and `lifetimeSpend` per customer (only counts orders with status in `paid|processing|shipped|delivered`).
- `GET /api/admin/customers/:id` — single customer profile + full order history (all statuses, including pending/cancelled), with the same lifetime spend aggregation.

**List page features:**
- Debounced search (300ms) so we don't hammer the API on every keystroke
- Columns: name, email, orders, lifetime spend, joined date, "View →" link

**Detail page features:**
- Profile header with name, email, member-since date, role
- Two big stat cards: total orders, lifetime spend
- Full order history table (newest first) with status pills, item count, total, tracking number, and "View →" links to `/admin/orders/:id` for status changes / line item review
- Back link to `/admin/customers`

**What's still not built:**
- 🔴 Cannot edit a customer's email or contact details
- 🔴 Cannot manually adjust their orders from the customer page (must navigate to the order detail page)
- 🔴 No customer-facing notes/tags for ops use

### 8.8 Analytics & reporting 🟡 PARTIAL

**What exists:** Google Analytics 4 integration (GA4 page views, purchase events, add-to-cart events). Accessible via GA4 dashboard, not in the admin panel.

**What's missing:** In-admin dashboards for sales, revenue, top products, conversion rate. All the data is in the database, just not visualized.

---

## 9. Email Notifications

### 9.1 The three-email strategy ✅ BUILT (partially — see subsections)

Based on the workflow conversation, three email touchpoints work together:

| Touchpoint | Fires | Recipient | Status |
|------------|-------|-----------|--------|
| **Per-order fulfillment email** | Every successful payment | `contact@antivaxxer.com` | 🟡 Partial — customer email built, ops email not built |
| **Weekly inventory digest** | Scheduled Monday morning | `contact@antivaxxer.com` | 🔴 Design target |
| **Low-stock alert** | Threshold crossing in webhook | `contact@antivaxxer.com` | ✅ Service built, not wired |

**Email recipient configuration:**
- Environment variable: `INVENTORY_ALERT_EMAIL`
- Default: `contact@antivaxxer.com`
- Overridable via AWS Secrets Manager — easy to change without code deploy

### 9.2 Customer-facing emails ✅ BUILT (mostly)

Sent via AWS SES from `orders@antivaxxer.com` (or whatever is set in `SES_FROM_EMAIL`).

| Email | Trigger | Template |
|-------|---------|----------|
| Order confirmation | Stripe webhook success | `sendOrderConfirmation(order)` |
| Abandoned cart recovery | Cron job | `sendAbandonedCartEmail(cart)` |
| Password reset | `POST /api/auth/forgot-password` | `sendPasswordResetEmail({ email, name, resetUrl })` ✅ v5.3.5 |

**Not yet built (gap):**
- Shipping notification (when admin sets status=shipped)
- Delivery confirmation (when Shippo reports delivered)
- Welcome email after registration
- Review request (post-delivery)

### 9.3 Per-order fulfillment email ✅ BUILT (v5.3.8)

**Fires:** on every successful Stripe payment, after inventory is deducted, in a try/catch (non-blocking — order is already confirmed regardless of email outcome).

**Implementation:** `sendFulfillmentEmail({ order, inventoryChanges })` in `api/src/services/email.js`. Called from `api/src/routes/webhooks.js` right after the customer order confirmation email.

**Recipient:** `process.env.INVENTORY_ALERT_EMAIL` (defaults to `contact@antivaxxer.com`)

**Purpose:** give ops everything they need for that order in one place — sale details, inventory snapshot of the items purchased after deduction, and a deep link to the admin order page.

**Content (built):**
- Subject: `[NEW ORDER] AV-2026-00123 — $178.00`
- Brand-styled HTML body + plain text fallback
- Customer email
- Full shipping address
- Line items table with SKU, quantity, and **stock-after-deduction count** (color-coded red ≤5, yellow ≤15, green otherwise)
- Totals breakdown (subtotal, shipping, tax, total)
- Direct link to `/admin/orders/[id]` for label printing and tracking updates

**Future enhancement (Session D part 2 / Shippo work):** when Shippo is wired in, the email will include the Shippo label URL, carrier name, and tracking number directly so ops can grab the label without clicking through.

**Original design** (kept for reference):
```
Subject: [ANTIVAXXER] New Order #AV-2026-00123 — $178.00

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
NEW ORDER — AV-2026-00123
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Customer: Jane Doe
Email: jane@example.com
Total: $178.00
Payment: Stripe •••• 4242

SHIPPING TO:
Jane Doe
123 Main St
Austin, TX 78701

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ITEMS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1x Definition Tee — Black, L — $38.00
   SKU: AV-TEE2-BLK-L
   Stock after sale: 27 units

1x Nike Pro Hooded Jacket — Navy/Game Royal, L — $145.00
   SKU: AV-OUT8-NGR-L
   Stock after sale: 9 units ⚠️ LOW

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FULFILLMENT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[When Shippo is built:]
  Shippo Label: https://shippo.com/label/xyz.pdf
  Carrier: USPS Priority Mail
  Tracking: 9405511206212345678901

[Until Shippo is built:]
  READY FOR MANUAL FULFILLMENT
  - Generate label at Shippo, ShipStation, or UPS portal
  - Update tracking in admin at /admin/orders/AV-2026-00123

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
View in admin: https://antivaxxer.com/admin/orders/AV-2026-00123
```

**Design target for implementation:**

New function in `api/src/services/email.js`:
```javascript
async function sendOrderFulfillmentEmail(order, inventorySnapshot) {
  // ... build email with items, stock after sale, Shippo info if available
}
```

Called from `webhooks.js` after the inventory deduction step, wrapped in a try/catch so email failures don't roll back the order.

### 9.4 Weekly inventory digest 🔴 DESIGN TARGET

**Fires:** Every Monday at 6 AM UTC via EventBridge → Lambda → cron endpoint

**Recipient:** `contact@antivaxxer.com`

**Purpose:** strategic awareness — you're not reading 200 individual order emails to spot trends

**Content (proposed):**
```
Subject: [ANTIVAXXER] Weekly Inventory Digest — Week of YYYY-MM-DD

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
WEEK SUMMARY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Orders this week: 47
Revenue this week: $3,842.00
Average order value: $81.74
vs. last week: +12%

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
TOP SELLERS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. Definition Tee — 23 sold
2. Classic Tee — 18 sold
3. Trucker Hat — 14 sold
4. Signature Hoodie — 9 sold
5. Yeti Tumbler — 7 sold

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
LOW STOCK (below reorder threshold)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

⚠️ Definition Tee — Black, 3XL: 2 units
⚠️ Nike Pro Hooded Jacket — Navy, L: 4 units
⚠️ Yeti Tumbler — Black: 3 units

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SLOW MOVING (no sales in 30 days)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Remmy Performance Hoodie — 0 sales
Stainless Steel Tumbler — 0 sales

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
FULL INVENTORY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[Full table of every SKU with current stock]
```

**Implementation plan:**
1. New endpoint: `POST /api/admin/cron/inventory-digest` (behind `CRON_TOKEN` auth)
2. New service: `api/src/services/inventoryDigest.js` with `buildWeeklyDigest()` function
3. New Lambda: `antivaxxer-inventory-digest-cron`
4. New EventBridge rule: `rate(7 days)` or `cron(0 6 ? * MON *)` for Monday 6 AM UTC
5. New email template in `email.js`: `sendInventoryDigest(digest)`

### 9.5 Low-stock alert ✅ BUILT

**Service exists:** `api/src/services/inventoryAlerts.js`

**Exports:**
- `checkInventoryLevels(purchasedItems)` — checks if any purchased variant crossed a threshold
- `sendInventoryAlert(to, from, warnings, critical)` — builds and sends the email
- `WARNING_THRESHOLD` = 15 (default, overridable via `INVENTORY_WARNING_THRESHOLD` env var)
- `REORDER_THRESHOLD` = 5 (default, overridable via `INVENTORY_REORDER_THRESHOLD` env var)

**The gap:** The service isn't called from the Stripe webhook handler yet. When a payment succeeds and inventory is deducted, nothing triggers the alert check.

**Fix:** Add one line to `webhooks.js` after inventory deduction:
```javascript
await checkInventoryLevels(order.items);
```

**Priority:** Should be done before launch.

### 9.6 SES sandbox escape 🟡 PARTIAL

AWS SES starts in "sandbox mode" — can only send to verified email addresses, 200/day limit. To send to real customers, you must request production access.

**Pre-launch requirement:**
1. Verify your sending domain in SES (DKIM records)
2. Request production access with use case description
3. Approval typically takes 24-48 hours
4. Once approved, SES will send to any address with a 50,000/day limit

**This is documented in `AMPLIFY_DEPLOYMENT_GUIDE.md` Phase 4.**

---

## 10. Background Jobs & Cron

### 10.1 Cron infrastructure ✅ BUILT

**The pattern:** AWS EventBridge → Lambda → HTTP POST → protected API endpoint

**Why this pattern:**
- No need to run a scheduler process inside the API
- EventBridge handles scheduling reliability and retry
- Lambda provides the auth token without exposing secrets
- API endpoints are idempotent so retries are safe

### 10.2 Cron endpoints ✅ BUILT

| Endpoint | Schedule | Purpose |
|----------|----------|---------|
| `POST /api/admin/cron/abandoned-carts` | Every 15 min | Process abandoned carts past the recovery delay, send recovery emails |
| `POST /api/admin/cron/cleanup` | Daily at 3 AM UTC | Delete recovered/expired abandoned carts older than 7 days |
| `POST /api/admin/cron/inventory-digest` 🔴 | Weekly Monday 6 AM | Send inventory digest email (design target) |

**Authentication:** All cron endpoints are protected by `adminAuth` middleware, which accepts the `CRON_TOKEN` bearer token.

**Endpoint contract:**
- Returns `{ success: true, processed: number, timestamp: ISO8601 }` on success
- Returns 401 if auth missing, 403 if wrong token, 500 with error details on service failure
- Always logs to CloudWatch via `console.log`/`console.error`

### 10.3 Lambda function template 📋 RECIPE (not shipped as a file)

The cron API endpoint is built and live in the API. The Lambda invoker
is operator infrastructure and is NOT shipped in this repo — copy this
10-line function into the AWS Lambda console (or an equivalent scheduler
on Render/Railway/Vercel Cron):

```javascript
export const handler = async () => {
  const url = `${process.env.API_URL}/api/admin/cron/abandoned-carts`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.CRON_TOKEN}` },
  });
  const result = await response.json();
  console.log('Cron result:', result);
  if (!response.ok) throw new Error(`Cron failed: ${response.status}`);
  return result;
};
```

Environment variables:
- `API_URL` — the App Runner service URL
- `CRON_TOKEN` — sourced from Secrets Manager (`antivaxxer/prod/cron-token`)

### 10.4 EventBridge rules ✅ BUILT (configured manually)

Rules are created in AWS Console per `AMPLIFY_DEPLOYMENT_GUIDE.md` Phase 11:
- `antivaxxer-abandoned-cart-schedule` — `rate(15 minutes)` → `antivaxxer-abandoned-cart-cron` Lambda
- `antivaxxer-cleanup-schedule` — `cron(0 3 * * ? *)` → `antivaxxer-cleanup-cron` Lambda
- `antivaxxer-inventory-digest-schedule` 🔴 — `cron(0 6 ? * MON *)` → `antivaxxer-inventory-digest-cron` Lambda (not yet built)

### 10.5 Monitoring cron health

CloudWatch alarms should be set for:
- Lambda function errors > 0 in 5 minutes
- Lambda duration > 30 seconds (cron endpoints should finish in seconds)
- API 5xx errors on `/api/admin/cron/*` paths

---

## 11. Data Model Reference

The full Prisma schema is in `api/prisma/schema.prisma`. This is a functional summary of all 15 models and their relationships.

### 11.1 Product catalog (6 models)

**Category** — top-level product groupings (Tees, Hoodies, Hats, etc.)
- `id`, `name`, `slug`, `sortOrder`
- has many: Product

**Color** — reusable color records with hex codes
- `id`, `name`, `hexCode`, `sortOrder`
- has many: ProductColor, Variant, ProductImage (optional)

**Size** — reusable size records (S, M, L, XL, 2XL, 3XL, OS)
- `id`, `name`, `sortOrder`
- has many: ProductSize, Variant

**Product** — the top-level product record
- `id`, `name`, `slug`, `categoryId`, `basePrice`, `comparePrice`, `description`, `variantLabel`, `badge`, `status`, `featured`, `sortOrder`, `seoTitle`, `seoDesc`
- belongs to: Category
- has many: ProductColor, ProductSize, Variant, ProductImage, Wishlist

**ProductColor** — join table between Product and Color (which colors are available for this product)

**ProductSize** — join table between Product and Size (which sizes are available for this product)

**Variant** — a specific SKU (product × color × size combination)
- `id`, `productId`, `colorId`, `sizeId`, `sku`, `stockQty`, `priceOverride`, `weightOz`
- belongs to: Product, Color, Size
- has many: OrderItem

**ProductImage** — images associated with a product, optionally tagged with a specific color
- `id`, `productId`, `colorId`, `url`, `altText`, `sortOrder`, `isPrimary`
- belongs to: Product, Color (optional)

### 11.2 Orders (2 models)

**Order** — a complete order
- `id`, `orderNumber` (human-readable like AV-2026-00123), `userId` (nullable for guest), `email`, `status`, `subtotal`, `discountAmount`, `shippingAmount`, `taxAmount`, `total`, `currency`, `paymentIntentId`, `promoCodeId`, `shippingAddress` (JSON), `billingAddress` (JSON), `trackingNumber`, `trackingUrl`, `shippedAt`, `deliveredAt`, `notes`, `createdAt`, `updatedAt`
- belongs to: User (optional), PromoCode (optional)
- has many: OrderItem, PromoUsage

**OrderItem** — a line in an order
- `id`, `orderId`, `variantId`, `productName` (snapshot), `sku` (snapshot), `color` (snapshot), `size` (snapshot), `quantity`, `unitPrice` (snapshot), `totalPrice`
- belongs to: Order, Variant

**Why the snapshots?** If a product is renamed or deleted later, historical orders still show what the customer actually bought.

### 11.3 Users and auth (1 model)

**User** — customer and admin accounts
- `id`, `email`, `passwordHash`, `firstName`, `lastName`, `role` (`customer` or `admin`), `createdAt`, `updatedAt`
- has many: Order, Wishlist

### 11.4 Promos (2 models)

**PromoCode** — a discount code
- `id`, `code`, `discountType` (`percent` or `fixed`), `discountValue`, `minOrderAmount`, `maxUses`, `maxUsesPerUser`, `startsAt`, `expiresAt`, `isActive`, `usageCount`
- has many: Order, PromoUsage

**PromoUsage** — tracks which users have used which codes how many times
- `id`, `promoCodeId`, `userId`, `orderId`, `usedAt`
- belongs to: PromoCode, User, Order

### 11.5 Wishlist (1 model)

**Wishlist** — saved items
- `id`, `userId`, `productId`, `createdAt`
- belongs to: User, Product
- Unique constraint on `(userId, productId)` — can't save the same product twice

### 11.6 Abandoned cart (1 model)

**AbandonedCart** — cart snapshots saved when email is entered at checkout
- `id`, `email`, `userId` (optional), `cartData` (JSON with line items), `recoveryToken`, `recovered`, `recoveredAt`, `emailSentAt`, `createdAt`
- belongs to: User (optional)

### 11.7 Model relationships diagram

```
Category ──┬──< Product ──┬──< Variant ──< OrderItem >── Order ──< User
           │              │                              │
           │              ├──< ProductColor >── Color    ├──< PromoUsage >── PromoCode
           │              │                              │
           │              ├──< ProductSize >── Size      └── shippingAddress (JSON)
           │              │
           │              ├──< ProductImage
           │              │
           │              └──< Wishlist >── User
           │
           └── sortOrder, name, slug

AbandonedCart ──(optional FK)── User
```

---

## 12. API Endpoint Reference

All endpoints prefixed with `/api`. Default base URL: `https://api.antivaxxer.com/api` in production.

### 12.1 Public endpoints (no auth)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Health check with DB connectivity verification |
| GET | `/products` | List products, filterable by category, featured, sortBy |
| GET | `/products/:slug` | Get single product by slug with full variant + image data |
| GET | `/categories` | List all categories |
| GET | `/search?q=` | Search products |
| POST | `/newsletter/subscribe` | Subscribe email to Mailchimp list |
| POST | `/auth/register` | Create a new user account |
| POST | `/auth/login` | Log in and receive JWT |
| POST | `/checkout` | Create Order + Stripe PaymentIntent |
| POST | `/webhooks/stripe` | Stripe webhook receiver (signature-verified) |
| GET | `/cart/recover/:token` | Recover abandoned cart by token |
| POST | `/cart/save` | Save cart state as abandoned cart (used at checkout email entry) |

### 12.2 Customer endpoints (JWT required)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/account/orders` | List user's orders |
| GET | `/account/orders/:id` | Get single order detail |
| GET | `/account/wishlist` | List user's wishlist items |
| POST | `/account/wishlist/:productId` | Add product to wishlist |
| DELETE | `/account/wishlist/:productId` | Remove product from wishlist |

### 12.3 Admin endpoints (admin JWT, ADMIN_TOKEN, or CRON_TOKEN)

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/admin/products` | List all products for admin view |
| GET | `/admin/products/:id` | Single product with variants |
| POST | `/admin/products` | Create new product |
| PUT | `/admin/products/:id` | Update product fields |
| PUT | `/admin/products/:id/variants` | Bulk update variant stock/prices |
| POST | `/admin/products/:id/images` | Upload image (multipart) |
| DELETE | `/admin/products/:id/images/:imageId` | Delete image |
| PUT | `/admin/products/:id/images/reorder` | Reorder images |
| GET | `/admin/options` | Get all colors, sizes, categories |
| GET | `/admin/orders` | List all orders |
| GET | `/admin/orders/:id` | Single order detail |
| PUT | `/admin/orders/:id/status` | Update order status, tracking, notes |
| GET | `/admin/promos` | List all promo codes |
| POST | `/admin/promos` | Create promo code |
| PUT | `/admin/promos/:id` | Update promo code |
| POST | `/admin/cron/abandoned-carts` | Process abandoned carts (cron) |
| POST | `/admin/cron/cleanup` | Clean up old abandoned carts (cron) |

### 12.4 Error response format

All errors return:
```json
{
  "error": {
    "code": "SNAKE_CASE_CODE",
    "message": "Human-readable error message."
  }
}
```

Common error codes: `VALIDATION_ERROR`, `UNAUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `INTERNAL_ERROR`, `CONFLICT`.

### 12.5 Rate limiting

All endpoints are behind a base rate limiter (100 req/15min per IP). Specific endpoints have tighter limits:
- `/admin/*` — admin limiter (stricter)
- `/checkout` — checkout limiter (prevents abuse)
- `/auth/register` — register limiter (prevents spam signups)

Implemented in memory via `express-rate-limit`. At scale, should be moved to Redis-backed rate limiting.

---

## 13. Integration Points

### 13.1 Stripe ✅ BUILT

- **SDK:** `stripe` npm package (latest)
- **Credentials:** `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` from Secrets Manager
- **What we use:**
  - PaymentIntents API (creates payment on checkout)
  - Webhooks (receives payment_intent.succeeded / payment_intent.payment_failed)
  - Customer creation (for authenticated checkouts)
- **What we don't use yet:**
  - Stripe Tax (gap, see section 14)
  - Refunds API (gap, see section 14)
  - Subscriptions (not needed)
  - Apple Pay / Google Pay (enabled via Stripe Elements but untested)

### 13.2 AWS SES ✅ BUILT

- **SDK:** `@aws-sdk/client-ses`
- **Credentials:** auto-detected from App Runner instance role (no explicit keys)
- **What we use:** transactional email sends
- **Configuration:** `SES_FROM_EMAIL` env var (must be verified in SES)
- **Limits:** 50,000/day after sandbox escape, 14/second sending rate

### 13.3 AWS S3 + CloudFront ✅ BUILT

- **SDK:** `@aws-sdk/client-s3`
- **Credentials:** auto-detected from App Runner instance role
- **What we store:**
  - Product images in 3 sizes (thumb/card/full) as webp
  - Originals kept as backup
- **Bucket structure:** `images/products/{productId}/{size}-{hash}.webp`
- **CDN:** CloudFront with OAC pointing at the S3 bucket
- **URLs stored in `ProductImage.url`** as full CloudFront URLs

### 13.4 Mailchimp ✅ BUILT

- **Purpose:** newsletter subscriber list
- **Credentials:** `MAILCHIMP_API_KEY` from Secrets Manager (optional — graceful degradation if missing)
- **What we use:** subscribe endpoint only (no campaigns sent from the app)
- **Integration point:** `POST /api/newsletter/subscribe` → Mailchimp List API
- **Graceful failure:** if Mailchimp is unreachable or API key is missing, the subscribe returns success (200) but logs a warning. We don't want to fail user signups on third-party hiccups.

### 13.5 Cloudflare Turnstile ✅ BUILT (wired v5.4.6)

- **Purpose:** bot protection on registration and login forms
- **Credentials:**
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (public, frontend env)
  - `TURNSTILE_SECRET_KEY` (private, API env)
- **Backend:** `turnstileVerify` middleware in `api/src/middleware/turnstile.js`, mounted on `/api/auth` in `api/src/index.js`. Verifies tokens against Cloudflare's siteverify endpoint before the auth handler runs.
- **Frontend:** `TurnstileWidget` component in `frontend/src/components/auth/TurnstileWidget.js`. Loads Cloudflare's vanilla script (no extra npm dep), renders widget, captures token via callback. Mounted on `/account/register` and `/account/login`.
- **Login flow:** widget token captured in form state → passed via `signIn('credentials', { ..., turnstileToken })` → NextAuth `authorize()` callback in `frontend/src/lib/auth.js` forwards to `/api/auth/login` → middleware verifies before handler runs.
- **Register flow:** token sent directly in POST body to `/api/auth/register`.
- **Graceful degradation:**
  - If `TURNSTILE_SECRET_KEY` unset on the backend, verification is skipped (dev convenience).
  - If `NEXT_PUBLIC_TURNSTILE_SITE_KEY` unset on the frontend, widget renders nothing and immediately "verifies" with a placeholder so dev forms remain submittable.
  - If Cloudflare's verification API itself is down, the request is allowed through and a warning logs (rate limiting on `/api/auth` is the backup defense).

### 13.6 Google Analytics 4 ✅ BUILT

- **Credentials:** `NEXT_PUBLIC_GA4_ID` (public, in frontend env)
- **What we track:** page views, add_to_cart, begin_checkout, purchase
- **Privacy:** consent-gated via CookieYes integration — no tracking until user accepts

### 13.7 CookieYes ✅ BUILT

- **Purpose:** GDPR/CCPA cookie consent banner
- **Credentials:** `NEXT_PUBLIC_COOKIESYES_ID` (public)
- **Script loaded in `layout.js`** via `next/script`
- **Controls:** analytics/marketing cookies gated until consent

### 13.8 Shippo ✅ BUILT (v5.4.0)

**Service:** `api/src/services/shippo.js`
**Env var:** `SHIPPO_API_KEY` (plus `SHIPPO_FROM_*` for sender address)
**Endpoints:** `POST /api/admin/orders/:id/shipment`, `POST /api/admin/orders/:id/label`
**Webhook:** `POST /api/webhooks/shippo` (tracking updates → order status transitions)
**See section 7 for full flow documentation.**

Fully documented in section 7. Not yet implemented.

### 13.9 NextAuth ✅ BUILT

- **Purpose:** frontend session management
- **Strategy:** JWT with CredentialsProvider
- **Session shape:** `{ user: { id, email, role, apiToken } }`
- **The `apiToken` field is the key** — it's the backend JWT the frontend uses to authenticate API calls

---

## 14. Feature Gap List

Ordered by priority — critical items first.

> **v5.4.0 update:** Shippo end-to-end integration (#14) is ✅ COMPLETE. The full order lifecycle is now automated: `pending → processing (Stripe) → shipped (Shippo label) → delivered (Shippo tracking webhook)`.

> **v5.3.9 update:** The webhook inventory deduction race condition (item 17) is ✅ FIXED with a Prisma transaction and `SELECT FOR UPDATE` row locks. New FailedWebhook dead-letter queue + admin recovery UI + email alert ensures webhook failures are never silently dropped. See v5.3.9 changelog for full details. GAP_TRACKER.md remains the authoritative source for outstanding quality gaps.

> **v5.3.8 update:** Items 4 (per-order fulfillment email), 5 (Stripe Tax), and 20 (refunds API) are now ✅ COMPLETE. Shippo (#14) remains for v5.4.0.

> **v5.3.7 update:** Items 12 (order line-item editing) and 13 (product status enum extension) are now ✅ COMPLETE. The Stripe webhook also now auto-transitions orders straight from `pending → processing` (was `pending → paid` requiring a manual ops step). The remaining big item is Shippo end-to-end (#14) for `processing → shipped → delivered` automation.

> **v5.3.6 update:** Items 7 (Admin Dashboard), 8 (Admin Promo UI), 9 (Customer management), and 10 (Admin Inventory page) are now ✅ COMPLETE.

> **v5.3.5 update:** Items 11 (password reset) and the admin frontend auth gate are ✅ COMPLETE.

### 14.1 Pre-launch operator tasks 🟡

The codebase is feature-complete. Remaining items here are operator setup
tasks (third-party config, SES approval, first admin user, env vars) — none
require code changes. **See `PRE_LAUNCH_CHECKLIST.md` for the full runbook**
with step-by-step instructions, verification steps, and a final smoke-test
sequence. Summary of what the operator needs to do:

- AWS SES production access (24-48hr wait — start first)
- Verify the SES sending domain (DKIM/SPF)
- Create first admin user via SQL `UPDATE users SET role='admin'`
- Configure Stripe + Shippo webhook endpoints
- Cloudflare Turnstile site setup + env vars (codebase wired in v5.4.6)
- Generate `CRON_TOKEN` + configure scheduler for abandoned cart job
- Remove legacy `ADMIN_TOKEN` after first admin user exists

### 14.2 High-value enhancements 🟡

**4. ~~Per-order fulfillment email~~** ✅ DONE in v5.3.8
- See section 9.3 for the implementation. `sendFulfillmentEmail()` in `email.js` is wired into the Stripe webhook handler. HTML + text body with packing slip and color-coded post-deduction stock counts.

**5. ~~Stripe Tax integration~~** ✅ DONE in v5.3.8 (code-side)
- `automatic_tax: { enabled: true }` added to PaymentIntent creation in `checkout.js`
- **Still requires** Stripe dashboard activation (Settings → Tax → Activate Stripe Tax) and US state tax registrations before tax actually appears on orders. Without that activation, the flag is a no-op and tax stays at $0. This is a Stripe dashboard action, not a code deploy.

**6. ~~Shipping notification email~~** ✅ DONE in v5.4.1
- `sendShippingNotification()` in `email.js`. Fires from two trigger points:
  (1) Shippo label purchase (`POST /api/admin/orders/:id/label`) and
  (2) manual status change to `shipped` (`PUT /api/admin/orders/:id/status`).
  Includes tracking number + carrier link.

**7. ~~Admin Dashboard page~~** ✅ DONE in v5.3.6
- See section 8.2 for the implementation

**8. ~~Admin Promo code UI~~** ✅ DONE in v5.3.6
- See section 8.6 for the implementation. New `DELETE /api/admin/promos/:id` endpoint added with usage-record protection.

**9. ~~Admin Customer management page~~** ✅ DONE in v5.3.6
- See section 8.7 for the implementation. Two new endpoints added: `GET /api/admin/customers` and `GET /api/admin/customers/:id`.

**10. ~~Admin Inventory page~~** ✅ DONE in v5.3.6
- See section 8.4. Top-level `/admin/inventory` flattens all variants into one searchable view with filter tabs. Stock editing still happens on the product detail page (would need a new bulk-update endpoint to move it inline).

**11. ~~Password reset flow~~** ✅ DONE in v5.3.5
- See section 2.4 for the implementation

**12. ~~Order line-item editing~~** ✅ DONE in v5.3.7
- See section 8.5 for the implementation. New `PUT /api/admin/orders/:id/items` endpoint with full transaction-safe stock adjustment, recalculation, and audit trail. Frontend edit mode on `/admin/orders/[id]` with quantity inputs, remove buttons, variant picker, and live total preview.

**13. ~~Product status enum extension~~** ✅ DONE in v5.3.7
- See section 3.4 for storefront behavior and section 8.3 for admin dropdown options. No migration needed (status is a String column, not a Prisma enum). PDP, ProductCard, admin product edit/list, public products API, and validators all updated.

### 14.3 Shippo integration ✅ DONE (v5.4.0)

**14. ~~Shippo end-to-end integration~~** ✅ DONE in v5.4.0
- See section 7 for the complete implementation: service file, schema migration, admin endpoints (create shipment + purchase label), tracking webhook, frontend rate selection UI, label download. The full order lifecycle is now automated end-to-end.

### 14.4 Weekly operations 🔴

**15. Weekly inventory digest**
- See section 9.4 for full design
- New cron endpoint + Lambda + EventBridge rule + email template

**16. Admin analytics dashboard (deeper)**
- The basic dashboard ships in v5.3.6 (see 8.2). A deeper analytics page would add: revenue charts over time, conversion funnel, customer cohort retention, geographic heatmap.

### 14.5 Technical debt 🟡

**17. ~~Inventory race condition~~** ✅ DONE in v5.3.9
- The Stripe webhook payment success handler now wraps the entire order status update + inventory deductions in a single `prisma.$transaction` with explicit `SELECT FOR UPDATE` row locks on both the order row and each variant row. Concurrent webhook deliveries for the same order are serialized by the order lock; concurrent orders for the same low-stock variant are serialized by the variant locks. Insufficient stock throws inside the transaction and rolls everything back, sending the event to the DLQ for manual recovery.

**18. Search upgrade to pg_trgm**
- Install extension, add trigram index on product name/description
- Enables typo tolerance in search results

**19. Redis-backed rate limiting**
- Replace in-memory rate limiter with Redis
- Required at scale for multi-instance App Runner deployments
- Current in-memory approach works at single-instance scale

**20. ~~Refunds API integration~~** ✅ DONE in v5.3.8
- `POST /api/admin/orders/:id/refund` calls Stripe Refunds API. Frontend modal on `/admin/orders/[id]` with full/half quick buttons, custom amount input, optional reason field, partial vs full warning text, double-confirmation, and inline error display. Full refunds restock items and mark order `refunded`; partial refunds preserve status and don't restock. All actions logged to `order.notes` with the Stripe refund ID. See section 8.5.

### 14.6 Customer experience enhancements 🟡

**21. Product reviews**
- Data model + review submission + moderation UI + display on product pages
- Review request email after delivery

**22. Order lookup for guests**
- `/orders/lookup` page where a guest enters order number + email
- Currently guest orders have no post-purchase view

**23. Product recommendations**
- "You might also like" on product pages
- "Frequently bought together" at checkout
- Requires either a simple heuristic (same category) or a more sophisticated approach

### 14.7 Deferred entirely ⛔

**24. Loyalty program** — explicitly deferred per stakeholder decision. May leverage an existing tool in the stack (e.g., Mailchimp segments or a plug-in) rather than custom-building.

**25. Subscriptions / recurring orders** — not needed for the current product line.

**26. Multi-currency** — single currency (USD) for launch.

**27. Multi-language** — single language (English) for launch.

**28. International shipping** — US-only for launch.

---

## Appendix A: Key file locations

| File | Purpose |
|------|---------|
| `api/prisma/schema.prisma` | Data model source of truth |
| `api/prisma/seed.js` | Real product inventory (v5.3.2+) |
| `api/src/index.js` | Express app entry, middleware wiring, route mounting |
| `api/src/routes/*` | All API endpoint handlers |
| `api/src/services/email.js` | Email template and send functions |
| `api/src/services/inventoryAlerts.js` | Low-stock alert logic (wired in `webhooks.js` after inventory deduction) |
| `api/src/services/abandonedCart.js` | Cart recovery logic |
| `api/src/middleware/adminAuth.js` | 3-path admin auth (CRON_TOKEN, ADMIN_TOKEN, JWT) |
| `frontend/src/app/layout.js` | Root layout with all providers |
| `frontend/src/components/wishlist/WishlistContext.js` | Wishlist state management |
| `frontend/src/components/cart/CartContext.js` | Cart state management |
| `frontend/src/components/product/ProductModal.js` | Quick-view modal (v5.3.3 redesigned) |
| `AMPLIFY_DEPLOYMENT_GUIDE.md` | Full AWS deployment runbook |

## Appendix B: Environment variables

**Critical (required for launch):**
- `DATABASE_URL` — Postgres connection string
- `NEXTAUTH_SECRET` — session + JWT signing secret
- `STRIPE_SECRET_KEY` — live key for production
- `STRIPE_WEBHOOK_SECRET` — signing secret for webhook verification
- `SES_FROM_EMAIL` — verified sending address

**Important:**
- `CRON_TOKEN` — for Lambda → API cron calls
- `S3_BUCKET_NAME` — product image bucket
- `CLOUDFRONT_DOMAIN` — CDN domain for images
- `INVENTORY_ALERT_EMAIL` — recipient for per-order, digest, and low-stock emails (default: `contact@antivaxxer.com`)

**Optional / feature flags:**
- `MAILCHIMP_API_KEY` — newsletter sync (graceful degrade)
- `TURNSTILE_SECRET_KEY` — bot protection on auth forms (skipped if unset; widget on register/login wired in v5.4.6)
- `ADMIN_TOKEN` — legacy bootstrap token, remove after launch
- `ABANDONED_CART_DELAY_MS` — recovery email delay (default 1 hour)
- `INVENTORY_WARNING_THRESHOLD` — low stock warning level (default 15)
- `INVENTORY_REORDER_THRESHOLD` — critical stock level (default 5)

**Frontend-only (public, safe to commit to Amplify):**
- `NEXT_PUBLIC_API_URL` — backend API base URL
- `NEXT_PUBLIC_SITE_URL` — frontend base URL
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` — Stripe Elements key
- `NEXT_PUBLIC_GA4_ID` — Google Analytics measurement ID
- `NEXT_PUBLIC_COOKIESYES_ID` — CookieYes client ID
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — Cloudflare Turnstile public site key (paired with `TURNSTILE_SECRET_KEY`)

---

**End of specification.**

Questions, corrections, or additions should be discussed with the product owner and reflected back into this document. Keep this file in sync with the codebase — it's the source of truth for system behavior.
