# ANTIVAXXER — Path 2: Vercel + Railway/Render Launch Runbook

**Version:** v5.6.1 unified
**Last verified:**
**Audience:** Operator deploying to managed PaaS for the first production launch
**Time estimate:** 2-4 hours of active work, plus 24-48 hours wall-clock waiting for AWS SES approval

This document is the **single sequential runbook** for a Vercel + Railway (or Render) launch. It folds together hosting setup and the operator phases from `PRE_LAUNCH_CHECKLIST.md` into one ordered sequence.

If you'd rather use AWS, see `PATH_1_AWS_RUNBOOK.md`.

---

## Why this path is faster than AWS

| Concern | AWS | Vercel + Railway |
|---|---|---|
| Setup time | 8-12 hours | 2-4 hours |
| Services to configure | ~10 (VPC, RDS, S3, CloudFront, IAM, Secrets Manager, App Runner, Amplify, EventBridge, Lambda) | 3 (Vercel, Railway, AWS for SES+S3 only) |
| Env vars | Secrets Manager + ARN references | Plain console fields |
| Deploy mechanism | App Runner GitHub integration | git push triggers deploy |
| Monthly cost (low volume) | $50-90 | $20-40 |
| Maintenance burden | IAM rotation, VPC, security group changes | None — managed |
| When to consider migrating to AWS | Past ~50k orders/month, compliance requirements | — |

You can switch to AWS later. The codebase doesn't care which platform it runs on.

---

## Stack overview

| Component | Hosted on | Why |
|---|---|---|
| Frontend (Next.js) | **Vercel** | Free tier handles a lot; built for Next.js; auto preview deploys per branch |
| API (Express) | **Railway** OR **Render** | Either works; Railway slightly nicer UX, Render has a generous free tier |
| Database (PostgreSQL) | Railway/Render (built-in) | One-click provisioning, automated backups, internal connection URL |
| Email (transactional) | **AWS SES** | Cheapest reliable transactional email; Vercel/Railway don't offer this |
| Image storage | **AWS S3 + CloudFront** | Same reason — cheap durable object storage, CDN |
| Cron jobs | **Render Cron Jobs** OR **Vercel Cron** | Built-in, no Lambda needed |

**You still need a small AWS footprint** for SES + S3. Just two services, not the full AWS console marathon.

---

## How this runbook is organized

| Stage | What | Active time | Wall clock |
|---|---|---|---|
| 0 | Pre-flight: accounts, domain | 30 min | — |
| 1 | Wall-clock waits — START THESE FIRST | 30 min | 24-48 hours |
| 2 | AWS sliver: SES + S3 + CloudFront only | 1 hour | — |
| 3 | Stripe + Shippo + Cloudflare third-party config | 30 min | — |
| 4 | Deploy database + API (Railway or Render) | 30 min | — |
| 5 | Deploy frontend (Vercel) + custom domain | 30 min | DNS propagation 0-24 hours |
| 6 | First admin user + cron jobs + final smoke test | 30 min | — |
| 7 | Post-launch monitoring | ongoing | first 7 days |

**Don't deploy code until SES is approved (Stage 1).** Without SES production access, password reset and order confirmation emails won't reach real customers.

---

## Stage 0 — Pre-flight (30 minutes)

- [ ] **Vercel account** (free tier is fine to start; Pro at $20/mo adds team features)
- [ ] **Railway account** ($5/mo Hobby plan covers most launch usage) OR **Render account** (free tier with limits)
- [ ] **AWS account** (only for SES + S3)
- [ ] **Stripe account**
- [ ] **Shippo account**
- [ ] **Cloudflare account** (only for Turnstile bot protection)
- [ ] **Domain registered** at any registrar
- [ ] Repo pushed to GitHub (Vercel + Railway both deploy via GitHub integration)
- [ ] v5.6.1 bundle unzipped or repo at v5.6.1 codebase

This runbook uses **Railway** for API + DB. Render works the same way; substitute "Render" for "Railway" throughout if you prefer it.

---

## Stage 1 — Wall-clock waits (30 min active, 24-48 hours wall clock)

**Start these RIGHT NOW.**

### 1.1 Request AWS SES production access (24-48 hours wall clock)

1. AWS Console → SES → Account dashboard → "Request production access"
2. Mail type: **Transactional**
3. Use case: "Order confirmations, password resets, shipping notifications, and admin operational alerts for ecommerce platform. No marketing email — that's handled by Mailchimp."
4. Submit
5. Wait for AWS approval email

### 1.2 [PARALLELIZE] Verify SES sending domain

1. SES → Verified identities → Create identity → Domain
2. Domain: `antivaxxer.com`
3. Enable Easy DKIM
4. AWS gives you 3 CNAME records — add to your DNS
5. Wait 5-30 min for verification

### 1.3 [PARALLELIZE] Cloudflare Turnstile site setup (5 min)

1. Cloudflare Dashboard → Turnstile → Add Site
2. Site name: `antivaxxer-prod`
3. Domain(s): `antivaxxer.com` + any preview/staging subdomains (Vercel preview URLs use `*.vercel.app` — add that too)
4. Widget mode: **Managed**
5. Save Site Key (public) and Secret Key (private)

---

## Stage 2 — AWS sliver: SES + S3 only (1 hour)

You're using AWS only for transactional email and image storage. Skip everything else (no VPC, no RDS, no IAM roles for App Runner — Railway handles all that).

### 2.1 SES IAM user (15 min)

1. IAM Console → Users → Create user → `antivaxxer-ses-sender`
2. **Don't** attach AWS Console access — programmatic only
3. Attach inline policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["ses:SendEmail", "ses:SendRawEmail"],
    "Resource": "*"
  }]
}
```
4. After creating, go to user → Security credentials → Create access key
5. Use case: Application running outside AWS
6. Save the Access Key ID and Secret Access Key — you'll paste these into Railway env

### 2.2 S3 bucket + IAM user (15 min)

1. S3 → Create bucket: `antivaxxer-prod-images` (must be globally unique)
2. Region: `us-east-1` (or wherever you're keeping things)
3. Block ALL public access: **YES** (CloudFront serves it)
4. IAM Console → Users → Create user → `antivaxxer-s3-uploader`
5. Inline policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["s3:PutObject", "s3:DeleteObject", "s3:GetObject"],
    "Resource": "arn:aws:s3:::antivaxxer-prod-images/*"
  }]
}
```
6. Create access keys for this user too

### 2.3 CloudFront distribution (15 min)

1. CloudFront → Create distribution
2. Origin: the S3 bucket above
3. Origin access: Origin access control (OAC) → create new
4. Viewer protocol: Redirect HTTP to HTTPS
5. Cache policy: CachingOptimized
6. Wait for deploy (~5-10 min)
7. Save the CloudFront domain (`d1234abcd.cloudfront.net`)
8. Update S3 bucket policy as CloudFront prompts

### 2.4 Verify the SES setup

```bash
# From local machine, with the SES IAM user's keys configured
aws ses send-email \
  --from "noreply@antivaxxer.com" \
  --to "your-personal-email@gmail.com" \
  --subject "Test" \
  --text "Test from SES"
```

Should arrive within ~10 seconds. (Until production access is approved, recipient must be verified too — verify your personal email in SES first.)

---

## Stage 3 — Third-party config (30 min)

### 3.1 Stripe

For initial deployment, **start with test keys** (`sk_test_`, `pk_test_`). Switch to live at the end.

### 3.2 Shippo

1. Shippo Dashboard → API → API keys → copy production key
2. Set sender address values for the env (you'll paste these into Railway env in Stage 4):
   - `SHIPPO_FROM_NAME=ANTIVAXXER Fulfillment`
   - `SHIPPO_FROM_STREET=...`, etc.

### 3.3 Cloudflare Turnstile keys

You already have these from Stage 1.3.

### 3.4 Stripe Tax (optional)

Stripe Dashboard → Settings → Tax → Activate. Add registrations for relevant US states.

### 3.5 Webhook endpoints

URLs require deployed services. Skip for now — you'll come back in Stages 4.5 and 5.4.

---

## Stage 4 — Deploy database + API (Railway) (30 min)

### 4.1 Create Railway project

1. Railway Dashboard → New Project → Deploy from GitHub repo → pick your repo
2. Railway auto-detects the monorepo

### 4.2 Add PostgreSQL service

1. In the Railway project: + New → Database → PostgreSQL
2. Railway provisions a managed Postgres instance
3. Click the Postgres service → Variables → copy `DATABASE_URL` (you'll need this)

### 4.3 Configure the API service

1. Railway should have created a service from your GitHub repo. If not: + New → GitHub Repo → pick repo
2. Click the API service → Settings:
   - Root directory: `api`
   - Build command: `npm install && npx prisma generate`
   - Start command: `npx prisma migrate deploy && node src/index.js`
   - Watch paths: `api/**`

### 4.4 Configure API env vars

Click the API service → Variables → add (Railway has a "Raw Editor" — paste in bulk):

```
NODE_ENV=production
PORT=4000
DATABASE_URL=${{Postgres.DATABASE_URL}}
NEXTAUTH_SECRET=<run: openssl rand -base64 32>
JWT_SECRET=<same value as NEXTAUTH_SECRET>
JWT_EXPIRES=7d

# Stripe (test mode for now)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_pending_will_update_in_4.6

# AWS SES (from Stage 2.1)
AWS_REGION=us-east-1
AWS_ACCESS_KEY_ID=<SES IAM user access key>
AWS_SECRET_ACCESS_KEY=<SES IAM user secret>
SES_FROM_EMAIL=noreply@antivaxxer.com
INVENTORY_ALERT_EMAIL=ops@antivaxxer.com

# AWS S3 (from Stage 2.2)
S3_BUCKET_NAME=antivaxxer-prod-images
CLOUDFRONT_DOMAIN=d1234abcd.cloudfront.net
# These need a SECOND set of AWS credentials for the S3 user. Either:
# (a) use the same SES creds (broaden the SES user's policy to include S3)
# (b) keep separate creds (add S3_ACCESS_KEY_ID and S3_SECRET_ACCESS_KEY here, update imageUpload.js)
# Recommendation: (a) for simplicity at launch — broaden to include S3 actions

# Cloudflare Turnstile (from Stage 1.3)
TURNSTILE_SECRET_KEY=<from Cloudflare>

# Shippo (from Stage 3.2)
SHIPPO_API_KEY=<from Shippo>
SHIPPO_FROM_NAME=ANTIVAXXER Fulfillment
SHIPPO_FROM_STREET=...
SHIPPO_FROM_CITY=...
SHIPPO_FROM_STATE=...
SHIPPO_FROM_ZIP=...
SHIPPO_FROM_COUNTRY=US

# Mailchimp (optional — leave out if not using newsletter)
MAILCHIMP_API_KEY=<from Mailchimp>
MAILCHIMP_SERVER_PREFIX=us1
MAILCHIMP_LIST_ID=<your list id>

# Cron token (generate now, you'll use it in Stage 6)
CRON_TOKEN=<run: openssl rand -base64 32>

# URLs (will update once you have a custom domain)
FRONTEND_URL=https://antivaxxer.vercel.app
NEXTAUTH_URL=https://antivaxxer.vercel.app

# Inventory thresholds + abandoned cart
INVENTORY_WARNING_THRESHOLD=15
INVENTORY_REORDER_THRESHOLD=5
ABANDONED_CART_DELAY_MS=3600000
```

**CRITICAL — confirm these are NOT set:**
- `STRIPE_API_BASE` (would route Stripe to local mock)
- `SES_ENDPOINT` (would route SES to local mock)
- `MAILCHIMP_BASE_URL` (would route Mailchimp to local stub)
- `ADMIN_TOKEN` (legacy bootstrap — security risk in production)

### 4.5 Deploy and verify

1. Railway auto-deploys on every push. The first deploy will run migrations as part of the start command.
2. Click the API service → Deployments → wait for "Active" status
3. Click the service → Settings → Networking → Generate Domain — Railway gives you a public URL (`https://antivaxxer-api-production.up.railway.app`)

```bash
# Health check
curl https://YOUR_RAILWAY_URL/api/health
# Expected: {"status":"ok","timestamp":"...","database":"connected"}

# List products (empty if no seed)
curl https://YOUR_RAILWAY_URL/api/products
```

If the health check shows `"database":"disconnected"`: migrations failed. Check Railway deploy logs.

### 4.6 Configure Stripe + Shippo webhooks

**Stripe:**
1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://YOUR_RAILWAY_URL/api/webhooks/stripe`
3. Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
4. Copy signing secret (`whsec_...`)
5. Update Railway env: `STRIPE_WEBHOOK_SECRET=whsec_...`
6. Railway auto-redeploys when env vars change

**Shippo:**
1. Shippo Dashboard → Settings → Webhooks → Add
2. URL: `https://YOUR_RAILWAY_URL/api/webhooks/shippo`
3. Event: `track_updated`

### 4.7 Optional: seed sample products

If you want demo products to test against:

```bash
# From local machine with DATABASE_URL pointing at Railway Postgres (copy from Railway → Postgres service)
DATABASE_URL=<railway_postgres_url> npx prisma db seed
```

---

## Stage 5 — Deploy frontend (Vercel) + custom domain (30 min active, 0-24 hours DNS propagation)

### 5.1 Create Vercel project

1. Vercel Dashboard → Add New → Project → Import Git Repository → pick your repo
2. Framework preset: Next.js (auto-detected)
3. Root Directory: `frontend`
4. Build & Output settings: defaults

### 5.2 Configure Vercel env vars

Vercel → Project Settings → Environment Variables. Add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://YOUR_RAILWAY_URL/api` (will update to custom domain after 5.5) |
| `NEXT_PUBLIC_SITE_URL` | `https://antivaxxer.vercel.app` initially, then your custom domain |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` for now |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | from Cloudflare 1.3 |
| `NEXT_PUBLIC_GA4_ID` | from Google Analytics (optional) |
| `NEXT_PUBLIC_COOKIESYES_ID` | from CookieYes (optional) |
| `NEXTAUTH_URL` | `https://antivaxxer.vercel.app` initially |
| `NEXTAUTH_SECRET` | same value as Railway's `NEXTAUTH_SECRET` |

**CRITICAL — confirm these are NOT set:**
- `STRIPE_API_BASE`
- `SES_ENDPOINT`
- `MAILCHIMP_BASE_URL`

### 5.3 First deploy

Vercel auto-deploys after env vars are saved. Build takes 2-4 min.

If the build fails: most common cause is missing `NEXT_PUBLIC_*` env vars. Add the missing one and redeploy.

### 5.4 Test the deployed frontend

1. Visit the Vercel-provided URL (looks like `https://antivaxxer.vercel.app`)
2. Browse `/shop` — products should load (if you seeded)
3. Try a test order with Stripe test card `4242 4242 4242 4242` — payment should succeed

### 5.5 Custom domain

1. Vercel Dashboard → Project → Settings → Domains → Add → `antivaxxer.com` and `www.antivaxxer.com`
2. Vercel gives you DNS records to add to your registrar
3. Wait for DNS propagation (5 min - 24 hours)
4. SSL is automatic
5. Add a CNAME for `api.antivaxxer.com` → Railway URL (in your registrar)
6. In Railway: API service → Settings → Networking → Custom Domain → add `api.antivaxxer.com`
7. Wait for both to propagate

Once DNS is live, update env vars to use the custom domain:
- Railway: `FRONTEND_URL=https://antivaxxer.com`, `NEXTAUTH_URL=https://antivaxxer.com`
- Vercel: `NEXT_PUBLIC_API_URL=https://api.antivaxxer.com/api`, `NEXT_PUBLIC_SITE_URL=https://antivaxxer.com`, `NEXTAUTH_URL=https://antivaxxer.com`
- Both auto-redeploy

---

## Stage 6 — First admin user + cron + final smoke test (30 min)

### 6.1 First admin user (CRITICAL)

1. Visit `https://antivaxxer.com/account/register`, register with your admin email
2. Welcome email arrives if SES is configured correctly
3. Connect to Railway Postgres (Railway → Postgres service → Connect → use any Postgres GUI like TablePlus, Postico, or psql with the connection URL):

```sql
SELECT id, email, role FROM users WHERE email = 'your-admin@antivaxxer.com';
UPDATE users SET role = 'admin' WHERE email = 'your-admin@antivaxxer.com';
```

4. Log out, log back in (JWT needs to reissue)
5. Navigate to `/admin` — you should see the dashboard

### 6.2 Cron job for abandoned cart recovery

Three options. Pick one based on your preferences:

**Option A: Railway cron service** (cleanest if you're already on Railway)
1. Railway project → + New → Cron
2. Schedule: `*/30 * * * *` (every 30 min)
3. Command:
```
curl -X POST -H "Authorization: Bearer $CRON_TOKEN" https://api.antivaxxer.com/api/admin/cron/abandoned-carts
```
4. Add env var `CRON_TOKEN` (same value as the API service's CRON_TOKEN)

**Option B: Vercel Cron** (use if frontend is on Vercel and you want everything in one place)
Add to `frontend/vercel.json`:
```json
{
  "crons": [
    {
      "path": "/api/cron/abandoned-carts",
      "schedule": "*/30 * * * *"
    }
  ]
}
```
Then create `frontend/src/app/api/cron/abandoned-carts/route.js`:
```js
export async function GET(request) {
  const url = `${process.env.API_URL}/api/admin/cron/abandoned-carts`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.CRON_TOKEN}` },
  });
  return Response.json(await response.json());
}
```
Add to Vercel env: `API_URL`, `CRON_TOKEN`. Vercel Cron is on Pro plan ($20/mo) — confirm before relying.

**Option C: External cron service** (cron-job.org is free)
1. Sign up at cron-job.org
2. Create a job hitting the same endpoint with the bearer token
3. No coupling to your hosting platform

### 6.3 Switch to Stripe live keys

1. Update Railway: `STRIPE_SECRET_KEY=sk_live_...`
2. Update Vercel: `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_live_...`
3. Stripe Dashboard → Developers → Webhooks → recreate the production webhook with live keys
4. Update Railway: `STRIPE_WEBHOOK_SECRET=whsec_...new`
5. Both services auto-redeploy

### 6.4 Final smoke test

Same 13-item checklist as Path 1:

- [ ] Register fresh test account at `/account/register` (Turnstile widget appears)
- [ ] Welcome email arrives within 30 seconds
- [ ] Browse `/shop`, add a product to cart
- [ ] Proceed to `/checkout`, enter shipping
- [ ] Pay with real card for $1.00
- [ ] Order transitions to `processing` within 5 seconds (`/admin/orders`)
- [ ] Order confirmation email arrives within 30 seconds
- [ ] Operations email arrives at `INVENTORY_ALERT_EMAIL`
- [ ] In `/admin/orders/<id>`, fetch Shippo rates, purchase a label
- [ ] Customer receives shipping notification email
- [ ] Mark tracking `DELIVERED` in Shippo
- [ ] Order auto-transitions to `delivered`
- [ ] Delivery confirmation email arrives
- [ ] Refund the order from `/admin/orders/<id>`
- [ ] Stripe processes refund, order shows `refunded`
- [ ] Inventory restocks correctly

If all 13 boxes check, **you are launched**.

---

## Stage 7 — Post-launch monitoring (first 7 days)

- **Stripe Dashboard → Webhooks** — confirm 100% success rate. Failures show in `/admin/failed-webhooks`.
- **Railway logs** — search API service logs for `level=error`. Each error has a `requestId` you can give to a customer for support. (Railway has built-in log search; Render uses `render logs --tail`.)
- **Vercel logs** — frontend error logs in the Vercel dashboard.
- **`/admin/dashboard`** — daily order count, low-stock alerts, abandoned cart count.
- **AWS SES → Reputation dashboard** — bounce rate <5%, complaint rate <0.1%.
- **`/admin/failed-webhooks`** — should be empty.
- **Railway / Vercel billing dashboards** — confirm spend matches estimate.

---

## Estimated monthly cost (low volume)

| Service | Cost |
|---|---|
| Vercel (Hobby/free tier) | $0 (or $20 for Pro) |
| Railway Hobby plan | $5 base + usage |
| Railway PostgreSQL | included in Hobby; ~$5-10 if separate |
| AWS SES | $0 (free tier covers ~62k emails/mo) |
| AWS S3 + CloudFront | $2-5 |
| AWS IAM users | $0 |
| Cron service | $0 (Railway included; cron-job.org free) |
| **Total** | **~$10-40/mo** at launch |

Add Stripe transaction fees (2.9% + $0.30/order) and Stripe Tax (~$1/state/mo) on top.

---

## Rollback procedures

| Scenario | Action |
|---|---|
| Bad code deploy on API | Railway → Deployments → click previous → "Redeploy" |
| Bad code deploy on frontend | Vercel → Deployments → previous → "Promote to Production" |
| Bad migration | Railway Postgres backups (daily) → restore. Manual `prisma migrate resolve --rolled-back` if needed |
| Stripe webhook signature mismatch | Recreate endpoint in Stripe, update Railway env |
| First admin user lost access | Connect to Railway Postgres, re-promote in SQL |

---

## What to do when something breaks

1. **Check `/admin/failed-webhooks` first** — most critical-path issues land there
2. **Check Railway / Vercel logs** for `level=error` JSON logs — every error has a `requestId`
3. **Roll back code** — see procedures above
4. **Worst case:** v5.4.0 release was the last "feature" release. Everything after is hardening, fixes, observability, tests, docs. v5.4.0 alone is launch-capable for full rollback.

---

## When to migrate to AWS

The codebase doesn't care which platform. Reasons to migrate eventually:

- **Past ~50k orders/month** — Railway pricing scales linearly; AWS RDS + App Runner is cheaper at scale
- **Compliance requirements** — SOC2, HIPAA, etc. require VPC isolation
- **Team operates AWS daily** — consolidate vendor footprint
- **Need fine-grained IAM / audit** — beyond what Railway/Vercel offer

Until then, this stack is genuinely fine for a streetwear store launch.

---

## Cross-references

- AWS path (more control, more setup): `PATH_1_AWS_RUNBOOK.md`
- Original detailed Vercel guide: `docs/DEPLOYMENT_GUIDE.md`
- Operator setup tasks (without hosting-specific steps): `docs/PRE_LAUNCH_CHECKLIST.md`
- System architecture + feature reference: `docs/SITE_WORKFLOW_SPEC.md`
- Local dev setup: `docs/SETUP.md`
