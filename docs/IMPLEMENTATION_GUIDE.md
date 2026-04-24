# ANTIVAXXER — Implementation Guide

**Version:** 5.2.1

**Deployment guides:**
- `DEPLOYMENT_GUIDE.md` — Vercel + AWS hybrid (recommended for fastest launch)
- `AMPLIFY_DEPLOYMENT_GUIDE.md` — All-AWS deployment (Amplify + App Runner + RDS + 11 other services)

**Audience:** Developers inheriting or extending this codebase

This document covers what each phase built, why decisions were made, where the gotchas are, and what still needs work. Read it before touching code.

---

## Architecture Overview

```
antivaxxer/
├── api/                    Express.js backend (port 4000)
│   ├── prisma/             Schema + migrations + seed
│   ├── src/
│   │   ├── index.js        Express app setup + route wiring
│   │   ├── lib/            Shared config (prisma.js, jwt.js)
│   │   ├── middleware/     Auth, rate limiting, validation, turnstile, errors
│   │   ├── routes/         10 route files
│   │   ├── services/       Email, image upload, abandoned cart
│   │   ├── utils/          Order number generator
│   │   └── validators/     Zod schemas for admin endpoints
│   └── package.json
├── frontend/               Next.js 15 (port 3000)
│   ├── src/
│   │   ├── app/            22 pages + 1 API route handler
│   │   ├── components/     13 components across 6 directories
│   │   ├── lib/            Analytics, admin auth hook
│   │   └── styles/         Tailwind globals
│   ├── public/             Static assets (logo, favicon)
│   └── package.json
├── shared/                 Constants used by both API and frontend
├── .env.example            All environment variables documented
└── package.json            Root workspace (npm install from here)
```

**Request flow:** Browser → Next.js (SSR + client) → Express API → PostgreSQL (via Prisma)

**Critical routing rule in `index.js`:** The Stripe webhook route is mounted BEFORE `express.json()`. Stripe requires the raw body for signature verification. If you move the webhook route below the JSON parser, all webhook signature checks will fail silently.

---

## Phase 1 — Foundation

### Purpose
Stand up the full stack: database schema, product catalog API, storefront UI, admin tools. After Phase 1, you can browse products, add to cart, and manage products in admin.

### What Was Built

**Database (8 models):** Category, Color, Size, Product, ProductColor, ProductSize, Variant, ProductImage. Products have a many-to-many relationship with colors and sizes through join tables. Variants are the actual purchasable SKUs (one per color+size combination). Each variant has its own `stockQty`.

**API:** `GET /api/products` (paginated, filterable by category, excludes `stockQty` from public response), `GET /api/products/:slug`, `GET /api/categories`. Admin: full CRUD for products with variant matrix management.

**Frontend:** Product grid with category filter, product modal with variant selection, cart (React Context + localStorage), cart drawer, static pages (about, FAQ, resources, US organization map).

**Seed data:** 16 products across 7 categories, 114 SKUs total.

### Implementation Details

**Variant matrix:** When an admin creates a product and selects 3 colors and 4 sizes, the API generates all 12 variant combinations automatically. Stock is tracked per-variant, not per-product. The admin can set stock on each combination individually.

**Cart is client-side only.** Cart state lives in React Context backed by localStorage. The API never stores cart data (until abandoned cart in Phase 5). This means carts don't sync across devices. A server-side cart would require session management — intentionally deferred.

**`stockQty` is never exposed in the public product API.** The public endpoint returns `totalStock` (a computed sum across variants) and `availability` (in_stock/low_stock/out_of_stock). The exact per-variant stock count is admin-only data.

### Watch For

- **Product slugs must be unique.** The slug is used in URLs and as a lookup key. Prisma enforces this at the database level.
- **Deleting a color or size that has variants will cascade.** The schema uses `onDelete: Cascade` on join tables but NOT on variants. If you delete a color used in active variants, you'll get a foreign key constraint error. Delete variants first.
- **The seed script is idempotent.** Running `npx prisma db seed` twice won't duplicate data — it uses `upsert` keyed on slug.

---

## Phase 2 — Commerce Core

### Purpose
Enable purchasing: Stripe payments, checkout flow, order management, email confirmations. After Phase 2, a customer can buy products.

### What Was Built

**Database (2 new models):** Order, OrderItem. Orders store address snapshots as JSON (frozen at purchase time). OrderItems snapshot product name, color, size, and price — so orders remain accurate even if products change later.

**API:** `POST /api/checkout/create-payment-intent` (validates cart server-side, looks up prices from DB — never trusts client prices), `POST /api/webhooks/stripe` (creates order on successful payment, deducts inventory, sends confirmation email).

**Frontend:** Multi-step checkout (review → address → payment with Stripe Elements). Order confirmation page.

**Email:** AWS SES order confirmation with branded HTML template.

### Implementation Details

**Server-side price validation.** The checkout endpoint receives cart items (variant IDs + quantities), then looks up every price from the database. The `amount` sent to Stripe is calculated entirely server-side. Never trust prices from the client.

**Webhook-driven order creation.** Orders are NOT created when the customer clicks "Pay." They're created when Stripe sends a `payment_intent.succeeded` webhook. This prevents orphaned orders from failed payments. The webhook handler:
1. Verifies the Stripe signature
2. Looks up the PaymentIntent metadata (cart items, email, addresses)
3. Creates the Order + OrderItems in a transaction
4. Deducts `stockQty` from each variant
5. Sends the confirmation email

**Deduplication.** The webhook stores `stripePaymentIntentId` with a unique constraint. If Stripe retries the webhook (which it does), the second attempt fails with a duplicate key error and returns 200 (Stripe stops retrying).

**Shipping:** Flat rate $5.99, free over $75. Configured in `shared/constants/index.js` as `SHIPPING.FLAT_RATE` and `SHIPPING.FREE_THRESHOLD`. The checkout route imports these constants.

**Tax:** Deferred. The schema has a `taxAmount` field on orders (defaults to 0). The architecture is ready for Stripe Tax — add `automatic_tax: { enabled: true }` to the PaymentIntent creation call.

### Watch For

- **Webhook endpoint must stay above `express.json()` in index.js.** See architecture note above. If you refactor route ordering, test webhooks immediately.
- **Stripe test mode vs live mode.** The keys in `.env` determine which mode you're in. Never put `sk_live_*` keys in development. The webhook secret is different per environment — register a separate webhook endpoint for each.
- **Inventory deduction is not atomic.** Two simultaneous purchases of the last item could both succeed. For high-traffic scenarios, add a Prisma transaction with optimistic locking (`where: { stockQty: { gte: quantity } }`). Currently the risk is low for the expected volume.
- **SES requires verified sender.** SES starts in sandbox mode — you can only send to verified email addresses. Request production access before launch.

---

## Phase 3 — User Accounts + Promo Engine

### Purpose
User authentication, order history, promo codes, bot protection. After Phase 3, customers can create accounts, view past orders, and apply discount codes.

### What Was Built

**Database (3 new models):** User, PromoCode, PromoUsage. Users have email/password (bcrypt, cost factor 12) and a role field (customer or admin).

**Auth chain (end-to-end):**
1. Customer submits email + password to `POST /api/auth/login`
2. Express verifies password with `bcrypt.compare`
3. Express issues a signed JWT (`jwt.sign` with `NEXTAUTH_SECRET`, 7-day expiry) containing `userId`, `email`, `role`
4. NextAuth's CredentialsProvider stores this JWT as `apiToken` in the session
5. Frontend pages send `Authorization: Bearer <apiToken>` to Express
6. Express middleware calls `jwt.verify()`, extracts `userId`, queries the database to confirm the user exists and has the required role
7. Expired, tampered, or forged tokens are rejected at step 6

**Admin auth has two paths:**
- **JWT path (primary):** The token is verified and the user's role is checked in the database. Even if someone steals a valid JWT from a customer account, it will fail the `role === 'admin'` check.
- **Legacy ADMIN_TOKEN (fallback):** If `ADMIN_TOKEN` is set in `.env` and the Bearer token matches it, access is granted. This exists for the transition period. Remove `ADMIN_TOKEN` from `.env` once all admins have user accounts.

**Promo engine:** Supports percentage, fixed_amount, and free_shipping discount types. Validation checks: active status, date range (start/end), total usage cap, per-user usage cap, minimum order amount. PromoUsage tracks every application with user and order IDs.

**Turnstile:** Server-side CAPTCHA verification middleware. Graceful degradation — if `TURNSTILE_SECRET_KEY` is not set, requests pass through. If the Cloudflare API is down, requests pass through. Rate limiting is the backup layer.

### Implementation Details

**JWT_SECRET is defined in one place:** `api/src/lib/jwt.js`. Three files import from it: `routes/auth.js`, `routes/account.js`, `middleware/adminAuth.js`. If you need to change the secret resolution order or add rotation, change it in one file.

**Why NextAuth if we have our own JWT?** NextAuth handles session management on the frontend (encrypted cookies, CSRF protection, session refresh). Our Express JWT handles API authentication. They share the same secret (`NEXTAUTH_SECRET`) so they're interoperable but serve different purposes. NextAuth manages the browser session; our JWT authenticates API calls.

**Promo codes are validated at checkout time, not just at the "Apply" button.** The validation endpoint (`POST /api/promos/validate`) is for the UI preview. The actual discount is recalculated server-side during `create-payment-intent` using the same validation logic. A customer can't manipulate the discount amount.

### Watch For

- **The `useAdminAuth` hook handles all admin page auth.** All 4 admin pages import it. If you add a new admin page, use the same hook. Don't roll your own auth check.
- **Account routes verify JWT, not x-user-id headers.** Earlier versions used a forgeable `x-user-id` header. That was fixed. The JWT is the only source of user identity on the server.
- **`dev-secret-change-me` is a development fallback.** It exists so the server starts without configuration. In production, `NEXTAUTH_SECRET` must be set to a real random value (`openssl rand -base64 32`). The fallback should never be used in production.
- **Promo usage is tracked per-user by userId.** Guest checkout (no account) can still use promo codes, but per-user limits only apply to logged-in users. A guest could theoretically reuse a code by using different email addresses.

---

## Phase 4 — Production Polish

### Purpose
Make the site production-ready: real product images, SEO, legal compliance, security hardening. After Phase 4, the site can launch.

### What Was Built

**Image upload pipeline:** Multer receives the file (10MB max, jpeg/png/webp/gif). Sharp generates 3 webp versions: thumb (200px, cover crop), card (600px, cover crop), full (1200px, contain). The original file is stored as backup in S3 under `images/products/{productId}/originals/{hash}.{ext}`. Webp files get `Cache-Control: public, max-age=31536000, immutable` for aggressive CDN caching.

**SEO:** JSON-LD structured data for Organization (brand), Product (price, availability, SKU), and BreadcrumbList. Dynamic `sitemap.xml` fetches active products from the API. `robots.txt` blocks `/admin/`, `/api/`, `/account/`, `/checkout/`.

**Legal pages:** Terms of Service, Privacy Policy, Return & Refund Policy, Shipping Policy. All use a shared `LegalPage` component with consistent styling. Attorney review required before launch — the templates establish structure, not legal advice.

**CookiesYes:** Loads via `next/script` with `beforeInteractive` strategy. Only loads if `NEXT_PUBLIC_COOKIESYES_ID` is set. Everything else (banner appearance, consent categories, cookie scanning) is configured in the CookiesYes dashboard.

**Security headers (via Helmet):**
- CSP: `script-src` allows self + Stripe + CookiesYes. `connect-src` allows self + Stripe API + Turnstile. `frame-ancestors: 'none'` prevents clickjacking.
- HSTS: 1 year, includeSubDomains, preload
- Cross-Origin-Opener-Policy: same-origin
- Permissions-Policy: camera/microphone/geolocation disabled, payment allowed
- Referrer-Policy: strict-origin-when-cross-origin

**Environment validation on startup:** The server checks for required and optional env vars at boot. Missing `DATABASE_URL` logs an error. Missing optional vars (Stripe, NEXTAUTH_SECRET) log warnings. Secret values are never logged.

### Implementation Details

**Image URL structure:** The `primaryUrl` stored in the `product_images` table is always the card (600px) size. The thumb and full URLs are derivable from the card URL by replacing `card-` with `thumb-` or `full-`. This means you don't need to store 3 URLs per image.

**Image deletion cascades to S3.** When you delete an image via the admin API, the service attempts to delete all 3 webp sizes plus the original from S3. If the S3 delete fails (network issue, permissions), the database record is still deleted. Orphaned S3 objects should be cleaned up periodically.

**Admin layout has `robots: { index: false }`.** All pages under `/admin/*` inherit this metadata. Google will not index admin pages. If you add a new admin page outside the `/admin/` path, add `noindex` explicitly.

### Watch For

- **S3 bucket permissions.** The bucket needs `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` for the IAM role/user. CloudFront needs an Origin Access Identity (OAI) to serve private bucket objects. Public bucket access is NOT recommended.
- **Sharp requires native binaries.** It compiles on `npm install`. If you deploy to a different OS than your dev machine (e.g., Mac → Linux), run `npm install` on the deployment target. Docker handles this naturally.
- **CookiesYes must be configured for your domain.** The script ID is domain-specific. A staging domain needs its own CookiesYes configuration. The banner won't appear on localhost unless you configure it.
- **Legal pages need attorney review.** The templates are standard ecommerce boilerplate. Have a lawyer review and customize for your specific business model, jurisdiction, and data handling practices before launch.

---

## Phase 5 — Growth & Optimization

### Purpose
Analytics, product discovery, customer engagement, and retention tools. After Phase 5, the site has data on customer behavior and automated follow-up.

### What Was Built

**GA4 Analytics:** gtag.js loaded via `next/script` with consent-aware initialization. Default consent state is `denied` for both `analytics_storage` and `ad_storage`. Events only fire after CookiesYes grants consent. Ecommerce event helpers: `trackViewItem`, `trackAddToCart`, `trackBeginCheckout`, `trackPurchase`, `trackSearch`.

**Product Search:** `GET /api/search?q=logo` searches product name, description, and category name using PostgreSQL `ILIKE` (case-insensitive). Results return active products only, limited to 50. Search page at `/search` with product card grid. Search icon in the Header.

**Wishlist:** Database-stored (Wishlist model with unique constraint on userId + productId). Three endpoints on the account route: GET (list), POST (add), DELETE (remove). Members only — the heart icon is visible to guests but clicking redirects to login.

**Mailchimp:** `POST /api/newsletter/subscribe` makes a server-side API call to Mailchimp's `/lists/{listId}/members` endpoint. Handles `Member Exists` gracefully (returns success). If Mailchimp is not configured, the endpoint accepts the signup and logs a warning.

**Abandoned Cart:** AbandonedCart model with `recoveryToken` (64-char hex, unique). The service saves cart state when an email is entered at checkout. `processAbandonedCarts()` finds carts older than the configurable delay (`ABANDONED_CART_DELAY_MS`, default 3600000 = 1 hour) with no matching completed order, then sends a recovery email via SES. The recovery email contains a branded CTA linking to `/cart/recover?token={token}`. `cleanupAbandonedCarts()` deletes recovered or expired carts older than 7 days.

### Implementation Details

**GA4 consent flow:**
1. Page loads → gtag initializes with `analytics_storage: 'denied'`
2. CookiesYes banner appears → user accepts analytics
3. CookiesYes fires a consent update event
4. gtag receives the update and begins tracking
5. If user declines, no data is ever sent to Google

This is GDPR/CCPA compliant. GA4 will show zero data until CookiesYes is configured and users start accepting.

**Search upgrade path:** ILIKE is simple but doesn't handle typos or partial matches well. To upgrade, enable the `pg_trgm` PostgreSQL extension (`CREATE EXTENSION pg_trgm;`), add a GIN index on the name/description columns, and switch the Prisma query to use raw SQL with `similarity()`. The endpoint structure stays identical.

**Abandoned cart is not a cron job.** The `processAbandonedCarts()` function exists but nothing calls it on a schedule. You need to wire it to one of: a cron job (`node -e "require('./services/abandonedCart').processAbandonedCarts()"`), AWS CloudWatch Events + Lambda, or a simple `setInterval` in the API process (not recommended for production). Same for `cleanupAbandonedCarts()`.

**Recovery page does not exist yet.** The abandoned cart email links to `/cart/recover?token={token}`, but this page has not been built. It needs to: call `recoverCart(token)` on the API, parse the returned `cartData` JSON, populate the cart context, and redirect to `/checkout`. This is a straightforward page — the service layer is complete.

### Watch For

- **GA4 shows no data without CookiesYes.** If you're testing analytics, either configure CookiesYes or temporarily change the default consent to `granted` in `analytics.js`. Remember to revert before launch.
- **Wishlist uses JWT auth, not x-user-id.** The account routes verify the signed JWT. If the JWT expires (7 days), the wishlist page will show an error and redirect to login.
- **Mailchimp API key format.** The key includes the server prefix (e.g., `abc123def456-us21`). Extract the part after the dash as `MAILCHIMP_SERVER_PREFIX`. The list ID is found in Mailchimp under Audience → Settings → Audience ID.
- **`ABANDONED_CART_DELAY_MS=0` disables the feature.** Setting it to 0 means `processAbandonedCarts()` finds everything immediately. If you want to truly disable it, don't run the processor.

---

## Still Needs Work

These are known gaps. None are blockers for launch, but all should be addressed.

Items 8, 11, 14, and 16 from the original list were completed in v5.1.0 (product detail page, cart recovery, variant images, inventory alerts).

### Must Do Before Launch

1. **Set real environment variables.** Replace all placeholder values in `.env`. Generate `NEXTAUTH_SECRET` with `openssl rand -base64 32`. Use live Stripe keys. Configure SES with a verified domain.

2. **Run migrations on production database.** `npx prisma migrate deploy` — this applies all 4 migrations in order. Then `npx prisma db seed` if you want the 16 demo products.

3. **Attorney review of legal pages.** Terms, privacy, returns, shipping. Customize the company name, jurisdiction, data handling specifics.

4. **Upload real product images.** The storefront shows "AV" placeholders until images are uploaded through the admin panel.

5. **Configure CookiesYes.** Create an account, add your domain, configure consent categories. Add the client ID to `NEXT_PUBLIC_COOKIESYES_ID`.

6. **Create an admin user.** Register a normal account, then update the role in the database: `UPDATE users SET role = 'admin' WHERE email = 'your@email.com';`. Then remove `ADMIN_TOKEN` from `.env`.

### Should Do Soon After Launch

7. **Wire abandoned cart processor to a cron.** Without this, recovery emails will never send. A simple approach: add a `POST /api/admin/cron/abandoned-carts` endpoint behind admin auth, and call it from an external scheduler.

8. **Add Stripe Tax.** Add `automatic_tax: { enabled: true }` to the PaymentIntent creation in `checkout.js`. Requires Stripe Tax to be enabled in your Stripe dashboard.

9. **Upgrade search to pg_trgm.** When search volume justifies it. See Phase 5 notes.

10. **Connect Shippo for real shipping rates.** Replace flat-rate logic in checkout with Shippo rate quotes. The address form already collects everything Shippo needs.

### Nice to Have

11. **Redis for rate limiting.** Currently uses in-memory store (resets on restart). For multi-instance deployments, switch to Redis (`rate-limit-redis` package).

12. **Email drip sequence.** Currently abandoned cart sends one email. Mailchimp automations can handle multi-step sequences.

---

## Conventions

**Error responses:** Always `{ error: { code: 'SNAKE_CASE', message: 'Human-readable.' } }`. Never return plain strings or different shapes.

**Prisma models:** Always include `@@map("snake_case_table_name")`. Field names use camelCase in code, `@map("snake_case")` for the database column.

**Shared constants:** Anything used by both API and frontend goes in `shared/constants/index.js`. Currently exports: CATEGORIES, SIZES, ORDER_STATUSES, PRODUCT_STATUSES, BADGES, SHIPPING, LAUNCH_PROMO_CODE, LAUNCH_PROMO_DISCOUNT.

**Auth headers:** Always `Authorization: Bearer <jwt>`. Never trust `x-user-id` or other client-supplied identity headers. The JWT is the only source of truth for user identity.

**File naming:** React components use PascalCase (`ProductCard.js`). API files use camelCase (`adminAuth.js`). Directories use lowercase (`routes/`, `middleware/`).

**Version naming:** `antivaxxer-v{MAJOR}.{MINOR}.{PATCH}-{description}.zip`. Major = phase completion. Minor = feature addition. Patch = bug fix.

---

## Environment Variables Reference

| Variable | Required | Phase | Purpose |
|----------|----------|-------|---------|
| `DATABASE_URL` | Yes | 1 | PostgreSQL connection string |
| `API_PORT` | No | 1 | Express port (default 4000) |
| `NODE_ENV` | No | 1 | development/production |
| `ADMIN_TOKEN` | No | 1 | Legacy admin auth fallback |
| `NEXT_PUBLIC_API_URL` | Yes | 1 | API base URL for frontend |
| `STRIPE_SECRET_KEY` | Yes | 2 | Stripe server-side key |
| `STRIPE_WEBHOOK_SECRET` | Yes | 2 | Webhook signature verification |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | 2 | Stripe client-side key |
| `SES_FROM_EMAIL` | No | 2 | Sender address for transactional email |
| `SES_REPLY_TO_EMAIL` | No | 2 | Reply-to address |
| `AWS_REGION` | No | 2 | AWS region for SES |
| `NEXTAUTH_URL` | Yes | 3 | NextAuth callback URL |
| `NEXTAUTH_SECRET` | Yes | 3 | JWT signing + NextAuth encryption |
| `TURNSTILE_SECRET_KEY` | No | 3 | Cloudflare CAPTCHA verification |
| `S3_BUCKET_NAME` | No | 4 | Image upload bucket |
| `CLOUDFRONT_DOMAIN` | No | 4 | CDN domain for images |
| `NEXT_PUBLIC_COOKIESYES_ID` | No | 4 | Cookie consent banner |
| `NEXT_PUBLIC_SITE_URL` | No | 4 | SEO canonical URLs |
| `NEXT_PUBLIC_GA4_ID` | No | 5 | Google Analytics measurement ID |
| `MAILCHIMP_API_KEY` | No | 5 | Newsletter subscription |
| `MAILCHIMP_SERVER_PREFIX` | No | 5 | Mailchimp datacenter |
| `MAILCHIMP_LIST_ID` | No | 5 | Mailchimp audience ID |
| `ABANDONED_CART_DELAY_MS` | No | 5 | Recovery email delay (default 3600000) |
| `INVENTORY_ALERT_EMAIL` | No | 5.1 | Email for stock alerts |
| `INVENTORY_WARNING_THRESHOLD` | No | 5.1 | Low stock warning level (default 15) |
| `INVENTORY_REORDER_THRESHOLD` | No | 5.1 | Critical reorder level (default 5) |

"No" means the feature degrades gracefully without it. "Yes" means the site won't function properly without it.
