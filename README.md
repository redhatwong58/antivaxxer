# ANTIVAXXER — Streetwear with a Statement

Premium streetwear ecommerce platform for the health freedom movement. Full-stack monorepo with a Next.js 15 storefront, Express.js API, PostgreSQL database, and integrated payments, shipping, email, and analytics services.

**Current version:** v5.6.1
**Status:** Feature-complete, launch-ready. **First production launch?** Read [`CHOOSE_DEPLOYMENT_PATH.md`](./CHOOSE_DEPLOYMENT_PATH.md) to pick AWS vs Vercel/Railway in 2 minutes, then follow the matching runbook.

---

## Documentation Map

Read these in order if you're picking up this project:

| Read this | When you need to |
|---|---|
| `README.md` (this file) | Get the high-level lay of the land |
| `docs/SETUP.md` | Run the project locally for the first time |
| `docs/SITE_WORKFLOW_SPEC.md` | Understand any feature in depth — source of truth for system behavior |
| `CHOOSE_DEPLOYMENT_PATH.md` | **Start here for first launch** — picks AWS vs Vercel/Railway |
| `PATH_1_AWS_RUNBOOK.md` | Unified AWS Amplify + App Runner runbook (8-12 hours) |
| `PATH_2_VERCEL_RAILWAY_RUNBOOK.md` | Unified Vercel + Railway runbook (2-4 hours, recommended) |
| `docs/DEPLOYMENT_GUIDE.md` | Per-deploy reference (build commands, env var details) |
| `docs/DEVELOPER_GUIDE.md` | Day-to-day development conventions |
| `CONTRIBUTING.md` | Branch strategy, commit conventions, code review checklist |
| `docs/VERSION_NAMING.md` | What shipped in each release |
| `changelogs/CHANGELOG_v5.*.md` | Per-release detail (23 changelogs, v5.3.4 through v5.6.0) |

---

## Architecture

```
┌─────────────────────────┐      ┌──────────────────────────┐
│   Next.js 15 Frontend   │      │    Express.js API         │
│   (Amplify / Vercel)    │─────>│    (App Runner / Railway) │
│                         │      │                          │
│  App Router (SSR)       │      │  REST endpoints          │
│  Tailwind CSS           │      │  JWT authentication      │
│  Stripe Elements        │      │  Zod validation          │
│  NextAuth.js            │      │  Prisma ORM              │
└─────────────────────────┘      └──────────┬───────────────┘
                                            │
              ┌─────────────────────────────┼───────────────────┐
              │                             │                   │
        ┌─────▼──────┐             ┌────────▼───┐       ┌──────▼──────┐
        │ PostgreSQL  │             │   Stripe   │       │  AWS SES    │
        │ (RDS)       │             │ Payments + │       │ Transaction │
        │ 10 models   │             │ Webhooks   │       │ Email       │
        └─────────────┘             └────────────┘       └─────────────┘
```

Additional integrations: AWS S3 + CloudFront (images), Shippo (shipping labels + tracking), Mailchimp (newsletter), Cloudflare Turnstile (bot protection), Google Analytics 4 (consent-aware), CookiesYes (cookie consent).

The frontend and API are separate deployable units. The frontend calls the API via `NEXT_PUBLIC_API_URL`. CORS on the API allows the configured domain, its www variant, and Amplify preview URLs (HTTPS only).

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 15 (App Router, SSR), React 18, Tailwind CSS, D3.js |
| Backend | Node.js 18+, Express.js |
| Database | PostgreSQL 16 + Prisma ORM (10 models, 7 migrations) |
| Validation | Zod (request body + query param schemas) |
| Auth | bcrypt (cost 12) + NextAuth.js CredentialsProvider + JWT (centralized config) |
| Payments | Stripe PaymentIntent + Webhooks + Stripe Tax |
| Shipping | Shippo (rate quotes, label purchase, tracking webhooks) |
| Images | AWS S3 + CloudFront CDN + Sharp (3 WebP size variants) |
| Transactional Email | AWS SES (8 email templates) |
| Marketing Email | Mailchimp (newsletter subscriptions) |
| Bot Protection | Cloudflare Turnstile (login + registration) |
| Analytics | Google Analytics 4 (consent-aware via CookiesYes) |
| Security | Helmet (CSP, HSTS), per-route rate limiting, CORS |
| SEO | JSON-LD (Organization + Product), robots.js, sitemap.js |
| Tests | Jest + supertest (integration), Playwright (E2E), React Testing Library |
| CI | GitHub Actions (parse, Prisma, build verification) |
| Local Dev | Docker Compose with stripe-mock, SES local, Mailchimp stub |

---

## Features

### Storefront
- Product grid with category filters and modal quick-view
- Full product detail pages with color + size variant selectors
- Variant-specific image filtering (select a color, see only that color's images)
- Live ILIKE product search
- Persistent shopping cart (localStorage) with drawer UI
- Cart recovery page for abandoned cart email links
- Interactive D3.js US organization map on Resources page
- 10-section homepage with branded components

### Checkout and Payments
- Multi-step checkout (shipping, billing, payment) with Stripe PaymentIntent
- Server-side price verification (never trusts client-submitted prices)
- Stripe Tax (automatic US sales tax when activated in Stripe Dashboard)
- Promo code engine: percentage, fixed-amount, and free-shipping types
- Per-user promo usage limits tracked via JWT
- Guest checkout + authenticated checkout (orders link to user account)

### User Accounts
- Registration and login via NextAuth.js with Cloudflare Turnstile
- bcrypt password hashing (cost factor 12)
- JWT session management with configurable expiry (`JWT_EXPIRES` env var)
- Password reset: SHA-256 hashed tokens, 1-hour expiry, anti-enumeration
- Account pages: order history with detail view, database-stored wishlist

### Order Lifecycle
- **Pending** → order created with Stripe PaymentIntent
- **Processing** → webhook confirms payment, inventory deducted atomically (row locks), confirmation + fulfillment emails sent
- **Shipped** → admin purchases Shippo label, tracking saved, shipping notification sent
- **Delivered** → Shippo tracking webhook fires, delivery confirmation sent
- **Refunded** → admin initiates full or partial refund via Stripe API, inventory restocked

### Admin Panel (`/admin`)
- Server-gated layout (non-admin users redirected)
- Dashboard with daily stats, top sellers, low-stock alerts
- Order management with line-item editing, Shippo label purchase, refund processing
- Product CRUD with S3 image upload (Sharp → 3 WebP sizes)
- Inventory monitoring with configurable alert thresholds
- Promo code CRUD with usage tracking
- Customer list with profile drill-down and order history
- Failed webhook DLQ with retry/resolve

### Email (8 templates, HTML + plain text)
- Order confirmation (line items, totals, discount, "Continue Shopping" CTA)
- Fulfillment packing slip (color-coded stock levels, admin link)
- Welcome email (WELCOME10 promo code — 10% off first order)
- Abandoned cart recovery (shows actual cart items, recovery link)
- Shipping notification (tracking number + carrier link)
- Delivery confirmation
- Password reset (SHA-256 token, 1-hour expiry)
- Webhook failure alert (notifies ops team)

### Security
- Helmet with Content Security Policy + HSTS
- Per-route rate limiting (login 10/15min, register 5/hr, checkout, admin)
- Stripe webhook signature verification
- Atomic inventory deduction with `SELECT ... FOR UPDATE` row locks
- Failed webhook dead-letter queue with admin recovery UI
- Idempotent webhook processing
- Error handler: structured JSON with requestId, no stack traces in production
- CORS: configured domain + www + Amplify preview (HTTPS only)

---

## Database Models

10 Prisma models across 7 migrations:

| Model | Purpose |
|---|---|
| Product | Catalog items (name, slug, basePrice, status, category) |
| Variant | SKU-level (color, size, stockQty, priceOverride, lowStockThreshold) |
| Order | Orders (addresses, Stripe refs, Shippo refs, promo, status lifecycle) |
| OrderItem | Line items (snapshot of product at purchase time) |
| User | Accounts (email, bcrypt hash, role, resetTokenHash) |
| PromoCode | Discount codes (type, value, date range, usage limits) |
| PromoUsage | Per-user promo tracking (promo + user + order) |
| AbandonedCart | Cart recovery (cartData JSON, email, recoveryToken) |
| FailedWebhook | Webhook DLQ (event payload, error, retry status) |
| Wishlist | User-product relationships |

---

## Project Structure

```
antivaxxer/
├── frontend/                Next.js 15 storefront + admin panel
│   ├── src/
│   │   ├── app/             App Router pages (shop, checkout, account, admin, search)
│   │   ├── components/      React components (layout, product, cart, home, seo, ui)
│   │   └── lib/             API client, NextAuth config, admin auth hook, analytics
│   ├── public/images/       Static assets (logos, seed product images)
│   └── e2e/                 Playwright E2E tests
├── api/                     Express.js REST API
│   ├── src/
│   │   ├── routes/          10 route files
│   │   ├── middleware/      Auth, rate limiting, error handling, request ID, Turnstile
│   │   ├── services/        Email (8 templates), image upload, inventory, Shippo, abandoned cart
│   │   ├── validators/      Zod schemas
│   │   ├── lib/             Prisma, JWT config, Stripe client, retry helper
│   │   └── index.js         Express app (middleware chain, route mounting)
│   ├── prisma/              Schema (10 models) + 7 migrations + seed
│   └── __tests__/           Integration tests (18 cases)
├── shared/constants/        Shipping rates + order statuses (used by frontend + API)
├── dev/                     Docker Compose + local mock services
├── changelogs/              23 release changelogs (v5.3.4 through v5.6.0)
├── docs/                    10 documentation files
├── apprunner.yaml           AWS App Runner config (15 Secrets Manager mappings)
├── amplify.yml              AWS Amplify build spec
├── .github/workflows/       CI: parse, Prisma, build verification
└── CONTRIBUTING.md          Branch strategy, commit conventions, PR checklist
```

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/your-org/antivaxxer.git
cd antivaxxer

cd api && npm install && cd ..
cd frontend && npm install && cd ..
```

### 2. Environment variables

```bash
cp .env.dev.example .env
```

At minimum for local development: `DATABASE_URL`, `NEXTAUTH_SECRET` (generate with `openssl rand -base64 32`), `JWT_SECRET` (same value), and Stripe test keys. See `.env.dev.example` for the full list.

### 3. Database

```bash
cd api
createdb antivaxxer_dev
npx prisma migrate dev
npm run db:seed
cd ..
```

### 4. Start servers

```bash
# Terminal 1 — API (port 4000)
cd api && npm run dev

# Terminal 2 — Frontend (port 3000)
cd frontend && npm run dev
```

### 5. Stripe webhooks (optional)

```bash
stripe listen --forward-to localhost:4000/api/webhooks/stripe
```

See `docs/SETUP.md` for complete local development instructions including mock services.

---

## Deployment

| Path | Stack | Time | Cost |
|---|---|---|---|
| AWS | Amplify + App Runner + RDS | 8-12 hours | ~$50-90/mo |
| Vercel/Railway | Vercel + Railway (API + DB) | 2-4 hours | ~$27-41/mo |

Start with [`CHOOSE_DEPLOYMENT_PATH.md`](./CHOOSE_DEPLOYMENT_PATH.md), then follow the matching runbook. Both include a 13-item smoke test covering the complete order lifecycle.

---

## Environment Variables

See `.env.dev.example` for the complete list. Key variables:

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Yes | JWT signing secret (shared with NextAuth) |
| `JWT_SECRET` | Yes | Same as NEXTAUTH_SECRET (fallback) |
| `JWT_EXPIRES` | No | Token lifetime (default: 7d) |
| `STRIPE_SECRET_KEY` | Yes | Stripe API key |
| `STRIPE_WEBHOOK_SECRET` | Yes | Stripe webhook signing secret |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Yes | Stripe publishable key (browser-safe) |
| `SES_FROM_EMAIL` | Prod | Verified SES sender email |
| `INVENTORY_ALERT_EMAIL` | Prod | Operations alert recipient |
| `S3_BUCKET_NAME` | Prod | Image upload bucket |
| `CLOUDFRONT_DOMAIN` | Prod | CDN domain for images |
| `SHIPPO_API_KEY` | Prod | Shippo shipping API key |
| `TURNSTILE_SECRET_KEY` | Prod | Cloudflare Turnstile server key |
| `NEXT_PUBLIC_SITE_URL` | Prod | Public URL (used in password reset emails) |

Never commit `.env` files. Only `.env.dev.example` is tracked.

---

## Available Scripts

### API (`cd api`)

| Script | Description |
|---|---|
| `npm run dev` | Start API with hot reload (nodemon) |
| `npm start` | Start API in production mode |
| `npm test` | Run integration tests (Jest + supertest) |
| `npm run db:migrate` | Run pending migrations (production) |
| `npm run db:seed` | Seed database with demo data |
| `npm run db:studio` | Open Prisma Studio |

---

## Version History

| Version | Milestone |
|---|---|
| v1.0.0 | Foundation — Prisma models, catalog API, storefront UI, admin panel |
| v2.0.0 | Commerce — Stripe payments, webhooks, checkout, SES emails |
| v3.0.0 | Accounts — NextAuth.js, bcrypt, JWT auth, promo codes, Turnstile |
| v4.0.0 | Polish — S3/Sharp images, SEO, legal pages, CookiesYes, Helmet |
| v5.0.0 | Growth — GA4, search, wishlist, Mailchimp, abandoned cart recovery |
| v5.1.0 | Product detail, cart recovery, inventory alerts, variant image filtering |
| v5.2.0 | UI overhaul — 10 homepage sections, 7 restyled files |
| v5.3.x | AWS deploy configs, admin console, order lifecycle, webhook DLQ, password reset |
| v5.4.x | Shippo shipping, observability, tests, local dev mocks, Turnstile wired |
| v5.5.x | Deployment runbooks, critical bugfixes (JWT field, shared constants), email promo display |
| v5.6.1 | Senior review — 15 improvements across product display, checkout, security, email, and infrastructure |

See `changelogs/CHANGELOG_v*.md` for per-release details.

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md) for branch strategy, commit conventions, and code review checklist.

## License

Proprietary. All rights reserved.
