# ANTIVAXXER — Deployment Guide

**Version:** 5.4.7
**Last Updated:**
**Audience:** DevOps engineer or full-stack developer deploying to production

This document covers per-deploy mechanics for the ANTIVAXXER stack on AWS, Vercel, Render, or Railway.

> 🚀 **First-time production launch?** This guide covers the deploy mechanics
> (build commands, env vars, migrations). For the operator setup tasks that
> only happen ONCE before the very first launch — SES production access
> request, first admin user creation, Stripe + Shippo + Turnstile webhook
> configuration, CRON_TOKEN generation, final smoke test — see
> **`PRE_LAUNCH_CHECKLIST.md`**. Don't skip it; the codebase is feature-complete
> but the third-party accounts and bootstrap data aren't.

The architecture below targets AWS; it adapts to Vercel, Render, or Railway with the option-specific notes in each section.

> **v5.4.6 deploy notes (Cloudflare Turnstile wiring):**
> 1. **No migration required** — pure code change.
> 2. **New env vars:**
>    - Frontend: `NEXT_PUBLIC_TURNSTILE_SITE_KEY` — public site key from Cloudflare Dashboard → Turnstile → Add Site
>    - API: `TURNSTILE_SECRET_KEY` — secret key from same Cloudflare site config
> 3. **Without these env vars,** the system still works — frontend widget renders nothing and immediately calls onVerify with a placeholder, backend middleware skips verification. Useful for dev/staging environments without Turnstile setup.
> 4. **Cloudflare site config:** at minimum, list `antivaxxer.com` and any preview domains in the Allowed Hostnames. Use the "Managed" widget mode for the lowest friction.

> **v5.4.0 deploy notes (Shippo integration):**
> 1. **Requires Prisma migration** — `npx prisma migrate deploy` adds 5 Shippo columns to the `orders` table. Run BEFORE deploying new API code.
> 2. **New env vars** — set these on the API server:
>    - `SHIPPO_API_KEY` — from Shippo dashboard → Settings → API
>    - `SHIPPO_FROM_NAME` (default "ANTIVAXXER"), `SHIPPO_FROM_STREET`, `SHIPPO_FROM_CITY`, `SHIPPO_FROM_STATE`, `SHIPPO_FROM_ZIP` — sender address for shipping labels
> 3. **Configure Shippo webhook** — in Shippo dashboard → Settings → Webhooks, add: URL `https://api.antivaxxer.com/api/webhooks/shippo`, event `track_updated`
> 4. Shippo is **optional for launch** — if `SHIPPO_API_KEY` is not set, the "Get Shipping Rates" button shows a clear error. Admins can still manage shipping manually (enter tracking numbers, set status to shipped from the dropdown).

> **v5.3.9 deploy notes (CRITICAL FIXES — deploy with care):**
> 1. **Requires Prisma migration** — `npx prisma migrate deploy` adds the `failed_webhooks` table. Run this BEFORE deploying the new API code or the DLQ writes will fail with a table-not-found error.
> 2. **Webhook inventory deduction is now atomic** — order status + all variant stock decrements happen in a single Prisma transaction with `SELECT FOR UPDATE` row locks. This is strictly safer than the previous non-atomic approach. If you see any issues with the row locks on your Postgres version, you can revert `webhooks.js` to the v5.3.8 version and the system goes back to the old (non-atomic) behavior.
> 3. **Failed webhook dead-letter queue** — any webhook handler failure now writes the event to `failed_webhooks` and emails the ops inbox. Admin can retry or resolve from `/admin/failed-webhooks`. Previously these failures were silently lost.
> 4. Verify `INVENTORY_ALERT_EMAIL` is set — the webhook failure alert goes to this address (defaults to `contact@antivaxxer.com`).
> 5. See `CHANGELOG_v5.3.9.md` "Known risks" section for Prisma `$queryRaw` caveats.

> **v5.3.8 deploy notes:**
> No env var changes, no Prisma migration. Pure code deploy. Three behaviors to verify after deploying:
> 1. **Refund button** — admins can issue full or partial Stripe refunds from `/admin/orders/[id]`. Full refunds restock; partial refunds don't.
> 2. **Per-order fulfillment email** — every successful payment now also emails `INVENTORY_ALERT_EMAIL` (defaults to `contact@antivaxxer.com`) a packing slip with post-deduction stock counts.
> 3. **Stripe Tax** — `automatic_tax: { enabled: true }` is now set on PaymentIntents. **This requires Stripe dashboard activation** (Settings → Tax → Activate Stripe Tax) AND adding US state tax registrations before tax actually appears on orders. Until you do that activation, this is a no-op and tax stays at $0. The activation is a Stripe dashboard action — there is no code deploy needed once you've activated.

> **v5.3.7 deploy notes:**
> No env var changes, no Prisma migration. Pure code deploy. Three behavior changes to verify after deploying:
> 1. **Order line-item editing** — admins can now edit items on pending/paid/processing orders via `/admin/orders/[id]`. Refuses to edit shipped+ orders. Restocks removed items, decrements added items, recalculates subtotal/total, audit trail in `order.notes`.
> 2. **Stripe webhook → processing** — new orders go straight to `processing` after payment success (was `paid`). Existing `paid` orders are unaffected; the legacy state still works in all queries (revenue, fulfillment counts, etc.).
> 3. **Product status `coming_soon` / `prelaunch`** — admins can mark products with these new statuses; the storefront PDP and ProductCard render appropriate badges and buy-button behavior. No data migration needed (status is a String column).

> **v5.3.6 deploy notes:**
> No env var changes, no Prisma migration. Pure code deploy. After deploying, smoke-test the four admin pages added in 5.3.6: `/admin` (dashboard), `/admin/inventory`, `/admin/promos`, `/admin/customers`. The existing `/admin/products` and `/admin/orders` are unchanged.

> **v5.3.5 deploy notes** (read this if you're upgrading from a pre-v5.3.5 version):
> 1. Run `npx prisma migrate deploy` — adds `users.reset_token_hash` and `users.reset_token_expires_at` columns for the password reset flow
> 2. Verify `NEXT_PUBLIC_SITE_URL` is set in the API environment (it's used to build the password reset link in the email body)
> 3. Verify `SES_FROM_EMAIL` is in **production** mode, not sandbox — sandbox mode silently drops emails to unverified addresses, which means new customers requesting password resets get nothing
> 4. The frontend `/admin/*` routes are now hard-gated on `role === 'admin'`. Anyone signed in as a non-admin gets redirected to `/403`. Verify at least one admin user exists in production before deploying or no one will be able to access the admin panel

---

## Production Architecture

```
                    ┌─────────────────┐
                    │   CloudFront    │
                    │   (CDN + SSL)   │
                    └────┬───────┬────┘
                         │       │
              ┌──────────┘       └──────────┐
              ▼                              ▼
    ┌──────────────────┐          ┌──────────────────┐
    │     Vercel        │          │   S3 Bucket      │
    │  (Next.js SSR)    │          │  (Product Images) │
    └────────┬─────────┘          └──────────────────┘
             │
             ▼
    ┌──────────────────┐
    │   EC2 / ECS      │
    │  (Express API)    │──── port 4000
    └────────┬─────────┘
             │
    ┌────────┴─────────┐
    │   RDS PostgreSQL  │
    │   (Prisma ORM)    │
    └──────────────────┘
```

External services: Stripe (payments), AWS SES (email), Cloudflare Turnstile (CAPTCHA), CookiesYes (consent), Google Analytics 4, Mailchimp (marketing).

---

## Option A: Recommended Stack (Vercel + AWS)

Best for: fast deployment, auto-scaling frontend, minimal DevOps.

### 1. Database — AWS RDS PostgreSQL

Create a PostgreSQL 15 instance in RDS.

**Settings:**
- Instance: `db.t3.micro` for launch ($15/mo), upgrade to `db.t3.small` when needed
- Storage: 20 GB GP3, auto-scaling enabled
- Multi-AZ: No for launch, Yes when revenue justifies ($30/mo extra)
- Public access: No (API server connects via VPC)
- Security group: Allow port 5432 from your API server's security group only

**After creation:**
```
DATABASE_URL=postgresql://antivaxxer_user:PASSWORD@your-rds-endpoint.us-east-1.rds.amazonaws.com:5432/antivaxxer_prod
```

Run migrations from a machine that can reach the RDS instance:
```bash
DATABASE_URL=postgresql://... npx prisma migrate deploy
DATABASE_URL=postgresql://... npx prisma db seed  # optional: load demo products
```

### 2. API Server — EC2 or ECS

**Option 2a: EC2 (simplest)**

Launch an `t3.micro` or `t3.small` Ubuntu 24 instance.

```bash
# On the EC2 instance
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Clone or upload the project
cd /opt
unzip antivaxxer-v5.1.0-detail-page-recovery-alerts.zip
cd antivaxxer

# Install dependencies
npm install --production
cd api && npx prisma generate && cd ..

# Create .env
cp .env.example .env
nano .env  # Set all production values (see Environment Variables below)

# Test
cd api && node src/index.js
# Should see: [antivaxxer-api] Server running on port 4000

# Install PM2 for process management
sudo npm install -g pm2
cd /opt/antivaxxer/api
pm2 start src/index.js --name antivaxxer-api
pm2 save
pm2 startup  # auto-restart on reboot
```

**Security group:** Allow port 4000 from your Vercel IP range (or use a load balancer with HTTPS termination).

**Option 2b: ECS Fargate (auto-scaling)**

Create a `Dockerfile` in the `api/` directory:
```dockerfile
FROM node:20-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN npx prisma generate
EXPOSE 4000
CMD ["node", "src/index.js"]
```

Push to ECR, create an ECS service with Fargate, attach an ALB. Environment variables go in the ECS task definition.

### 3. Frontend — Vercel

Vercel auto-detects Next.js and handles SSR, CDN, and SSL.

```bash
# Install Vercel CLI
npm install -g vercel

# From the frontend directory
cd antivaxxer/frontend
vercel

# Set environment variables in Vercel dashboard:
#   NEXT_PUBLIC_API_URL=https://api.antivaxxer.com/api
#   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...
#   NEXT_PUBLIC_SITE_URL=https://antivaxxer.com
#   NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
#   NEXT_PUBLIC_COOKIESYES_ID=your_id
#   NEXTAUTH_URL=https://antivaxxer.com
#   NEXTAUTH_SECRET=your-generated-secret
```

**Custom domain:** Add `antivaxxer.com` in Vercel dashboard → Domains. Point your DNS `A` record to Vercel's IP.

### 4. Image Storage — S3 + CloudFront

**S3 Bucket:**
```bash
aws s3 mb s3://antivaxxer-images-prod --region us-east-1
```

Bucket policy: block all public access. CloudFront will serve via OAI.

**CloudFront Distribution:**
- Origin: your S3 bucket
- Origin Access Identity: create one and grant it `s3:GetObject` on the bucket
- Default cache: 1 year (images have content-hash filenames, immutable)
- SSL: use the default `*.cloudfront.net` cert, or attach your own for `images.antivaxxer.com`

**IAM for API server:**
The API needs `s3:PutObject`, `s3:GetObject`, `s3:DeleteObject` on the bucket. Create an IAM user or role with these permissions.

### 5. Email — AWS SES

**Setup:**
1. Verify your domain in SES (add DKIM + SPF DNS records)
2. Request production access (sandbox limits to 200 emails/day)
3. Set sender address in `.env`: `SES_FROM_EMAIL=orders@antivaxxer.com`

**DNS records (from SES console):**
- 3 CNAME records for DKIM
- 1 TXT record for SPF: `v=spf1 include:amazonses.com ~all`
- 1 MX record if receiving email

### 6. SSL / Domain

**For the API:** Use an ALB with an ACM certificate, or Nginx as a reverse proxy on EC2:

```nginx
server {
    listen 443 ssl;
    server_name api.antivaxxer.com;

    ssl_certificate /etc/letsencrypt/live/api.antivaxxer.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.antivaxxer.com/privkey.pem;

    location / {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Install with certbot: `sudo certbot --nginx -d api.antivaxxer.com`

**DNS summary:**
| Record | Type | Value |
|--------|------|-------|
| `antivaxxer.com` | A | Vercel IP |
| `www.antivaxxer.com` | CNAME | `cname.vercel-dns.com` |
| `api.antivaxxer.com` | A | EC2 Elastic IP or ALB DNS |
| `images.antivaxxer.com` | CNAME | CloudFront distribution domain |

---

## Option B: All-AWS (EC2 for everything)

If you don't want Vercel, run the Next.js frontend on EC2 alongside the API.

```bash
# Build the frontend
cd /opt/antivaxxer/frontend
npm run build

# Start with PM2
pm2 start npm --name antivaxxer-frontend -- start -- -p 3000

# Nginx serves both
# api.antivaxxer.com → localhost:4000
# antivaxxer.com → localhost:3000
```

This costs less ($5-15/mo for one EC2) but you lose Vercel's CDN, auto-scaling, and preview deployments.

---

## Option C: Railway / Render (Simplest)

For the fastest deployment with zero infrastructure management.

**Railway ($5/mo):**
1. Connect GitHub repo
2. Railway auto-detects Node.js, deploys both services
3. Add PostgreSQL plugin (one click)
4. Set environment variables in Railway dashboard
5. Custom domain in settings

**Render:**
1. Create a Web Service for the API (Node.js, build command: `npm install && cd api && npx prisma generate`)
2. Create a Static Site or Web Service for the frontend
3. Create a PostgreSQL database
4. Wire them together via environment variables

---

## Environment Variables — Production Values

Copy `.env.example` and replace every placeholder. This is the complete list with production notes.

```bash
# === REQUIRED ===
DATABASE_URL=postgresql://user:pass@your-rds-endpoint:5432/antivaxxer_prod
NEXT_PUBLIC_API_URL=https://api.antivaxxer.com/api
NODE_ENV=production
API_PORT=4000

# Stripe (LIVE keys — not sk_test_)
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...

# Auth
NEXTAUTH_URL=https://antivaxxer.com
NEXTAUTH_SECRET=  # Generate: openssl rand -base64 32
JWT_SECRET=  # Used by API to verify NextAuth-issued tokens. Same value as NEXTAUTH_SECRET is acceptable.

# === EMAIL ===
AWS_REGION=us-east-1
SES_FROM_EMAIL=orders@antivaxxer.com   # Must be verified in SES; must be in production mode (not sandbox) for password reset emails to reach new users
SES_REPLY_TO_EMAIL=support@antivaxxer.com

# === IMAGES ===
S3_BUCKET_NAME=antivaxxer-images-prod
CLOUDFRONT_DOMAIN=d1234567890.cloudfront.net
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=...

# === INTEGRATIONS ===
NEXT_PUBLIC_SITE_URL=https://antivaxxer.com   # Used by API to build password reset links (v5.3.5+) — must be set on the API server, not just the frontend
NEXT_PUBLIC_COOKIESYES_ID=your_id
NEXT_PUBLIC_GA4_ID=G-XXXXXXXXXX
MAILCHIMP_API_KEY=abc123-us21
MAILCHIMP_SERVER_PREFIX=us21
MAILCHIMP_LIST_ID=abc123def

# === OPTIONAL ===
TURNSTILE_SECRET_KEY=...
NEXT_PUBLIC_TURNSTILE_SITE_KEY=...
ABANDONED_CART_DELAY_MS=3600000
INVENTORY_ALERT_EMAIL=ops@antivaxxer.com
INVENTORY_WARNING_THRESHOLD=15
INVENTORY_REORDER_THRESHOLD=5
```

**Do NOT set `ADMIN_TOKEN` in production.** Use NextAuth admin accounts instead. If you must use it during initial setup, remove it immediately after creating the first admin user.

---

## v5.3.5 — Post-Deploy Checklist

After deploying v5.3.5, run through this checklist before considering the release live.

### 1. Run the password reset migration

```bash
cd api
DATABASE_URL=postgresql://... npx prisma migrate deploy
```

This applies `20260414000000_add_password_reset/migration.sql` — adds `users.reset_token_hash` (VARCHAR 64, indexed) and `users.reset_token_expires_at` (TIMESTAMP).

Verify:
```bash
psql $DATABASE_URL -c "\d users" | grep reset_token
# Should show both columns
```

### 2. Promote the first admin user

The frontend `/admin/*` routes are now hard-gated. **Without an admin user nobody can access the admin panel.**

```bash
psql $DATABASE_URL -c "UPDATE users SET role='admin' WHERE email='you@antivaxxer.com';"
```

If no users exist yet, register one through the public `/account/register` page first, then run the SQL.

### 3. Smoke test the admin gate

| Step | Expected |
|---|---|
| Visit `/admin` while signed out | Redirects to `/account/login?callbackUrl=/admin` |
| Sign in as a customer (non-admin), visit `/admin` | Redirects to `/403` |
| Sign in as admin, visit `/admin` | Admin UI loads |

### 4. Smoke test password reset

| Step | Expected |
|---|---|
| Visit `/account/login`, click "Forgot password?" | Lands on `/account/forgot-password` |
| Submit a real registered email | "CHECK YOUR EMAIL" success page |
| Submit a fake email | Same "CHECK YOUR EMAIL" success page (no enumeration) |
| Check the recipient's inbox | Email arrives with brand styling and a reset link |
| Click the link | Lands on `/account/reset-password/[token]` form |
| Enter a new password (>= 8 chars) twice | Success page, redirected to login after 2.5s |
| Sign in with the new password | Works |
| Wait > 1 hour, then click an old reset link | "This reset link has expired" with "Request a new link" CTA |

### 5. Verify SES is in production mode

```bash
aws ses get-account-sending-enabled
aws ses get-send-quota
```

Sandbox mode = max 200 emails/day to verified addresses only. Production mode is required for password reset emails to reach new users. Request production access in the SES console — approval takes 24-48 hours.

### 6. Confirm `NEXT_PUBLIC_SITE_URL` is set on the API

Not just the frontend — the API server needs it to build the reset link:

```bash
ssh your-api-server 'cd /opt/antivaxxer && grep NEXT_PUBLIC_SITE_URL .env'
```

If missing, the reset link in the email defaults to `http://localhost:3000` and is unusable.

---

## Stripe Configuration

### Webhook Setup

1. Go to Stripe Dashboard → Developers → Webhooks
2. Add endpoint: `https://api.antivaxxer.com/api/webhooks/stripe`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy the signing secret → `STRIPE_WEBHOOK_SECRET`

### Testing Payments

Use Stripe test cards before going live:
- `4242 4242 4242 4242` — succeeds
- `4000 0000 0000 9995` — declines
- `4000 0027 6000 3184` — requires 3D Secure

### Going Live

1. Complete Stripe account activation (business details, bank account)
2. Switch from `sk_test_` to `sk_live_` keys in `.env`
3. Create a new webhook endpoint for production (test and live have separate secrets)
4. Test a real $1 purchase, then refund it

---

## Cron Jobs

Two scheduled tasks need external triggers.

### Abandoned Cart Recovery

Runs every 15 minutes. Finds carts older than 1 hour with no completed order, sends recovery email.

**EC2 crontab:**
```bash
*/15 * * * * cd /opt/antivaxxer && node -e "require('./api/src/services/abandonedCart').processAbandonedCarts().then(n => n > 0 && console.log('Processed', n, 'carts'))" >> /var/log/antivaxxer-cron.log 2>&1
```

**AWS CloudWatch Events + Lambda:**
Create a Lambda that makes an HTTP request to a protected endpoint, or runs the function directly.

### Abandoned Cart Cleanup

Runs daily. Deletes recovered or expired carts older than 7 days.

```bash
0 3 * * * cd /opt/antivaxxer && node -e "require('./api/src/services/abandonedCart').cleanupAbandonedCarts()" >> /var/log/antivaxxer-cron.log 2>&1
```

---

## Monitoring

### Application Logs

**PM2:**
```bash
pm2 logs antivaxxer-api      # real-time logs
pm2 logs antivaxxer-api --lines 100  # last 100 lines
```

**Key log patterns to monitor:**
- `[WEBHOOK]` — order processing events
- `[EMAIL]` — transactional email failures
- `[INVENTORY ALERT]` — stock threshold crossings
- `[NEWSLETTER]` — Mailchimp sync issues
- `[ERROR]` — unhandled errors (error middleware catches these)

### Health Check

```bash
curl https://api.antivaxxer.com/api/health
# Returns: { "status": "ok", "timestamp": "..." }
```

Set up an uptime monitor (UptimeRobot, Pingdom, or AWS Route 53 health check) to hit this endpoint every 60 seconds.

### Database

Monitor RDS in the AWS console: CPU, connections, storage. Set a CloudWatch alarm for CPU > 80% sustained.

---

## Backup Strategy

### Database

RDS automated backups: enable with 7-day retention. Manual snapshots before major deployments.

**Manual backup:**
```bash
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql
```

### Product Images

S3 versioning: enable on the bucket. Deleted images can be recovered from version history.

### Application Code

Git is the backup. Tag every deployment: `git tag -a v5.1.0 -m "Production deploy"`

---

## Deployment Checklist

Run through this before every production deploy.

```
[ ] All tests pass locally (npm run build, node --check on all files)
[ ] Environment variables set correctly (no test keys in production)
[ ] Database migrations applied (npx prisma migrate deploy)
[ ] Stripe webhook endpoint configured and tested
[ ] SES domain verified and out of sandbox
[ ] S3 bucket permissions correct (CloudFront OAI has access)
[ ] SSL certificates valid and not expiring soon
[ ] PM2 process running and set to auto-restart
[ ] Health check endpoint responding
[ ] Uptime monitor configured
[ ] First admin user created and ADMIN_TOKEN removed
[ ] CookiesYes configured for production domain
[ ] Legal pages reviewed by attorney
[ ] Cron jobs scheduled (abandoned cart, cleanup)
```

---

## Cost Estimate (Monthly)

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Pro | $20 |
| EC2 | t3.small | $15 |
| RDS PostgreSQL | db.t3.micro | $15 |
| S3 + CloudFront | First 50 GB | $2-5 |
| SES | First 62K emails | $0 (free tier) |
| Stripe | 2.9% + $0.30 per transaction | Variable |
| CookiesYes | Free or $49/mo | $0-49 |
| Domain + SSL | Annual | $12/yr |

**Estimated total: $55-105/mo** before Stripe transaction fees. Scales with traffic — the first 1000 orders/month won't require any infrastructure upgrades.
