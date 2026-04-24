# ANTIVAXXER — Path 1: AWS Amplify + App Runner Launch Runbook

**Version:** v5.6.1 unified
**Last verified:**
**Audience:** Operator deploying to AWS for the first production launch
**Time estimate:** 8-12 hours of active work, plus 24-48 hours wall-clock waiting for AWS SES approval

This document is the **single sequential runbook** for an AWS launch. It folds
together the infrastructure setup from `AMPLIFY_DEPLOYMENT_GUIDE.md` (the AWS
console work) and the operator phases from `PRE_LAUNCH_CHECKLIST.md` (the
third-party account work) into one ordered sequence so you don't have to
context-switch between documents.

If you'd rather use simpler hosting, see `PATH_2_VERCEL_RAILWAY_RUNBOOK.md`.

---

## How this runbook is organized

The 7 stages below run **mostly sequentially**, but a few are parallelizable.
Where you can do something in parallel to save wall-clock time, it's marked
**[PARALLELIZE]**.

| Stage | What | Active time | Wall clock |
|---|---|---|---|
| 0 | Pre-flight: AWS account, billing, region | 30 min | — |
| 1 | Wall-clock waits — START THESE FIRST | 30 min | 24-48 hours |
| 2 | AWS infrastructure: VPC, RDS, S3, CloudFront, IAM, Secrets Manager | 3-4 hours | — |
| 3 | Stripe + Shippo + Cloudflare third-party config | 1 hour | — |
| 4 | Deploy API (App Runner) and run migrations | 1-2 hours | — |
| 5 | Deploy Frontend (Amplify) and configure custom domain | 1 hour | DNS propagation 0-24 hours |
| 6 | First admin user + cron jobs + final smoke test | 1 hour | — |
| 7 | Post-launch monitoring | ongoing | first 7 days |

**Don't deploy code until SES is approved (Stage 1).** Without SES production
access, password reset and order confirmation emails won't reach real customers.

---

## Stage 0 — Pre-flight (30 minutes)

Before you touch anything, confirm:

- [ ] AWS account with billing alerts enabled (CloudWatch billing alarm at $50/mo to start)
- [ ] AWS region picked. **Recommendation: `us-east-1`** (most services available, lowest latency for US customers, default for many AWS services). All examples in this runbook assume `us-east-1`.
- [ ] Stripe account in test mode working
- [ ] Shippo account created
- [ ] Cloudflare account (only needed for Turnstile bot protection)
- [ ] Domain name registered (any registrar — Namecheap, Cloudflare, Route 53)
- [ ] Operator has `aws` CLI installed locally and configured (`aws configure`) with admin access
- [ ] Repo cloned locally and `npm install` completes from the v5.6.1 bundle

---

## Stage 1 — Wall-clock waits (30 min active, 24-48 hours wall clock)

**Start these RIGHT NOW so they're done by the time you need them.**

### 1.1 Request AWS SES production access (24-48 hours wall clock)

1. AWS Console → SES → Account dashboard → "Request production access"
2. Mail type: **Transactional**
3. Use case description: "Order confirmations, password resets, shipping notifications, and admin operational alerts for ecommerce platform. No marketing email — that's handled by Mailchimp."
4. Submit
5. **Wait for AWS approval email** (usually 24-48 hours)

Until approved, SES sandbox only sends to verified addresses.

### 1.2 [PARALLELIZE] Verify SES sending domain (~30 min after DNS propagation)

1. SES → Verified identities → Create identity → Domain
2. Domain: `antivaxxer.com` (or your domain)
3. Enable Easy DKIM
4. AWS gives you 3 CNAME records — add them to your DNS provider
5. Wait 5-30 min for verification
6. Confirm "Verified" status

### 1.3 [PARALLELIZE] Cloudflare Turnstile site setup (5 min)

1. Cloudflare Dashboard → Turnstile → Add Site
2. Site name: `antivaxxer-prod`
3. Domain(s): `antivaxxer.com` plus any preview/staging subdomains
4. Widget mode: **Managed** (lowest user friction)
5. **Save these somewhere secure for Stage 2:**
   - Site Key (public)
   - Secret Key (private — goes into Secrets Manager)

### 1.4 [PARALLELIZE] Domain DNS prep (5 min)

1. Decide where DNS lives: Route 53 (AWS-native, ~$0.50/mo per hosted zone), Cloudflare (free), or your registrar
2. If using Route 53: create a hosted zone for your domain now. Update your registrar's nameservers to point at Route 53. DNS propagation can take 24 hours.
3. You'll add A/AAAA/CNAME records in Stage 5 once Amplify gives you values

---

## Stage 2 — AWS infrastructure (3-4 hours)

This is the heavy lifting. All in AWS Console (or CLI if you prefer).

### 2.1 VPC + Networking

- Use the **default VPC** in your region. Don't create a custom VPC unless you have a specific reason — App Runner has a managed VPC connector that simplifies things.
- Confirm the default VPC has at least 2 public subnets and 2 private subnets across 2 AZs

### 2.2 RDS PostgreSQL (~30 min)

1. RDS Console → Create database
2. Engine: PostgreSQL 16
3. Templates: Production
4. Instance: `db.t4g.micro` ($13/mo) — sufficient for launch; upgrade later
5. Storage: 20 GiB gp3, encryption enabled
6. Multi-AZ: No (save $30/mo at launch; add later when revenue justifies)
7. VPC: default
8. Subnet group: default (private subnets only)
9. Public access: **No**
10. VPC security group: create new — `antivaxxer-rds-sg`
11. Database authentication: Password
12. Enable automated backups (7-day retention is fine to start)
13. Database name: `antivaxxer`
14. Username: `antivaxxer_admin`
15. Password: generate a strong random password — save it for Stage 2.5
16. Create

While it provisions (~10 min), continue to 2.3.

### 2.3 S3 + CloudFront (~20 min)

1. S3 → Create bucket
   - Name: `antivaxxer-prod-images` (must be globally unique — adjust if taken)
   - Region: same as everything else
   - Block ALL public access: **YES** (CloudFront will serve via OAC)
2. CloudFront → Create distribution
   - Origin: the S3 bucket above
   - Origin access: Origin access control (OAC) — create new
   - Viewer protocol: Redirect HTTP to HTTPS
   - Allowed methods: GET, HEAD
   - Cache policy: CachingOptimized
   - Compress objects automatically: Yes
   - Wait for distribution to deploy (~5-10 min)
3. Copy the CloudFront distribution domain (looks like `d1234abcd.cloudfront.net`) — save for Stage 2.5
4. Update the S3 bucket policy to allow OAC (CloudFront prompts you to copy the policy when creating the OAC)

### 2.4 IAM roles

You need three IAM roles. Create each in IAM Console → Roles → Create role:

**Role 1: `antivaxxer-apprunner-role`** (for App Runner to access AWS services)
- Trusted entity: AWS service → App Runner → "Tasks"
- Attached policies (managed):
  - None initially — we'll attach inline policies
- Inline policy to add (call it `antivaxxer-apprunner-policy`):
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["secretsmanager:GetSecretValue"],
      "Resource": "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:antivaxxer/prod/*"
    },
    {
      "Effect": "Allow",
      "Action": ["s3:PutObject", "s3:DeleteObject", "s3:GetObject"],
      "Resource": "arn:aws:s3:::antivaxxer-prod-images/*"
    },
    {
      "Effect": "Allow",
      "Action": ["ses:SendEmail", "ses:SendRawEmail"],
      "Resource": "*"
    }
  ]
}
```

**Role 2: `antivaxxer-cron-lambda-role`** (for the cron Lambda — created in Stage 6)
- Trusted entity: AWS service → Lambda
- Attached policies: `AWSLambdaBasicExecutionRole` (managed)
- Inline policy:
```json
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": ["secretsmanager:GetSecretValue"],
    "Resource": "arn:aws:secretsmanager:us-east-1:YOUR_ACCOUNT_ID:secret:antivaxxer/prod/cron-token-*"
  }]
}
```

**Role 3: Amplify build role** — Amplify Console will offer to create this for you on first connect. Accept the default.

### 2.5 Secrets Manager (~30 min — careful work)

Create each secret. AWS Console → Secrets Manager → Store a new secret → "Other type of secret".

**Pattern:** plain text value (not key-value pairs), name `antivaxxer/prod/<name>`, no rotation initially.

| Secret name | Value | Notes |
|---|---|---|
| `antivaxxer/prod/database-url` | `postgresql://antivaxxer_admin:PASSWORD@RDS_ENDPOINT:5432/antivaxxer?schema=public` | Use the RDS endpoint from 2.2 |
| `antivaxxer/prod/nextauth-secret` | run `openssl rand -base64 32` | Used for JWT signing — frontend AND backend must use the same value |
| `antivaxxer/prod/jwt-secret` | same value as `nextauth-secret` | Code reads either; centralizing them avoids bugs |
| `antivaxxer/prod/jwt-expires` | `7d` | Token lifetime |
| `antivaxxer/prod/stripe-secret-key` | `sk_test_...` for now (switch to `sk_live_` only at final smoke test) | Stripe → Developers → API keys |
| `antivaxxer/prod/stripe-webhook-secret` | placeholder `whsec_pending` | Real value created in Stage 3.2 |
| `antivaxxer/prod/cron-token` | run `openssl rand -base64 32` | Lambda → API auth |
| `antivaxxer/prod/ses-from-email` | `noreply@antivaxxer.com` | Must be on the SES-verified domain |
| `antivaxxer/prod/inventory-alert-email` | `ops@antivaxxer.com` | Where ops emails go |
| `antivaxxer/prod/s3-bucket-name` | `antivaxxer-prod-images` | From 2.3 |
| `antivaxxer/prod/cloudfront-domain` | `d1234abcd.cloudfront.net` | From 2.3 |
| `antivaxxer/prod/site-url` | `https://antivaxxer.com` | Used in password reset emails |
| `antivaxxer/prod/turnstile-secret` | from Cloudflare 1.3 | Bot protection |
| `antivaxxer/prod/shippo-api-key` | from Shippo (Stage 3.3) | Add when you have it |
| `antivaxxer/prod/mailchimp-api-key` | from Mailchimp | Optional — leave out if not using newsletter |

**Verify:** `aws secretsmanager list-secrets --region us-east-1 | grep antivaxxer/prod` should return all of them.

---

## Stage 3 — Third-party config (1 hour)

Now configure the third-party services that Stage 2 references.

### 3.1 Stripe live keys (defer until final smoke test)

For the initial deployment, **keep `stripe-secret-key` set to a test key** (`sk_test_`). This lets you do the smoke test without risking real charges. After the smoke test passes, you'll swap to `sk_live_`.

### 3.2 Stripe webhook endpoint

The webhook URL only exists after App Runner deploys (Stage 4). Skip this for now and come back after Stage 4.5.

### 3.3 Shippo (10 min)

1. Shippo Dashboard → API → API keys → copy production key
2. Update Secrets Manager: `antivaxxer/prod/shippo-api-key` → paste the key
3. Set Shippo sender address (this is **not** in Secrets Manager because it's not sensitive — set as plain App Runner env vars in Stage 4):
   - `SHIPPO_FROM_NAME=ANTIVAXXER Fulfillment`
   - `SHIPPO_FROM_STREET=...`
   - `SHIPPO_FROM_CITY=...`
   - `SHIPPO_FROM_STATE=...` (2-letter)
   - `SHIPPO_FROM_ZIP=...`
   - `SHIPPO_FROM_COUNTRY=US`
4. Tracking webhook configured in Stage 4.6 (after API URL exists)

### 3.4 Cloudflare Turnstile keys (5 min)

You already have these from Stage 1.3:
- Site key → goes in Amplify env (Stage 5) as `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
- Secret key → already in Secrets Manager

### 3.5 Stripe Tax activation (5 min, optional but recommended)

1. Stripe Dashboard → Settings → Tax → Activate Stripe Tax
2. Add registrations for US states where you have nexus
3. Without this, all orders ship at $0 tax even though the code sends `automatic_tax: { enabled: true }`

---

## Stage 4 — Deploy API (App Runner) + migrations (1-2 hours)

### 4.1 Push the v5.6.1 codebase to GitHub

If you haven't already:

```bash
cd /path/to/antivaxxer
git init
git add .
git remote add origin git@github.com:YOUR_ORG/antivaxxer.git
git push -u origin main
```

### 4.2 Connect App Runner to GitHub

1. App Runner Console → Create service
2. Source: **Source code repository**
3. Connect to GitHub → authorize → select your repo
4. Branch: `main`
5. Source directory: (leave empty — repo root). The `apprunner.yaml` handles `cd api` in its build and run commands. Setting this to `api` would break the build because the commands already navigate into the subdirectory.
6. Deployment trigger: **Automatic** (deploys on every push to main)
7. Configuration source: Use a configuration file (`apprunner.yaml` is already in the repo)

### 4.3 Configure App Runner service

1. Service name: `antivaxxer-api`
2. Virtual CPU: 0.25 vCPU, Memory: 0.5 GB (start small, scale later)
3. Port: 4000
4. Environment variables (plain — non-sensitive):
   - `NODE_ENV=production`
   - `AWS_REGION=us-east-1`
   - `INVENTORY_WARNING_THRESHOLD=15`
   - `INVENTORY_REORDER_THRESHOLD=5`
   - `ABANDONED_CART_DELAY_MS=3600000`
   - `FRONTEND_URL=https://antivaxxer.com`
   - `NEXTAUTH_URL=https://antivaxxer.com`
   - `SHIPPO_FROM_NAME` and all `SHIPPO_FROM_*` from 3.3
5. **Important:** confirm `STRIPE_API_BASE`, `SES_ENDPOINT`, `MAILCHIMP_BASE_URL` are NOT in the env vars list. Those route to local mocks and would break production.
6. Secrets (from Secrets Manager — referenced in `apprunner.yaml`): App Runner reads the ARNs from the file. Update `apprunner.yaml` if your account ID differs from the placeholder, and commit + push.
7. Auto scaling: min 1, max 3 instances
8. Health check: `/api/health` (every 10s, timeout 5s, healthy 1, unhealthy 3)
9. Security: IAM role → `antivaxxer-apprunner-role` (created in 2.4)
10. Networking: VPC connector → create new connector pointing at default VPC subnets + the `antivaxxer-rds-sg` security group (so App Runner can reach RDS)
11. Click "Create & deploy"
12. Wait 5-10 min for first deploy

### 4.4 Run migrations

App Runner's `apprunner.yaml` has migrations in the build phase, so the first deploy should run them. Verify:

```bash
# Get App Runner service URL from console (looks like https://abc123.us-east-1.awsapprunner.com)
curl https://YOUR_APPRUNNER_URL/api/health
# Expected: {"status":"ok","timestamp":"...","database":"connected"}
```

If `database` says "disconnected": migrations failed. Check App Runner logs (CloudWatch). Most common cause: RDS security group doesn't allow App Runner's VPC connector subnets. Fix in 2.2's security group.

If you need to run migrations manually:

```bash
# From local machine, with DATABASE_URL pointing at production RDS
DATABASE_URL=<production_url> npx prisma migrate deploy
DATABASE_URL=<production_url> npx prisma db seed   # optional: load demo products
```

### 4.5 Verify the API works

```bash
# Health check
curl https://YOUR_APPRUNNER_URL/api/health

# List products (should return seeded products if you ran the seed)
curl https://YOUR_APPRUNNER_URL/api/products
```

### 4.6 Stripe + Shippo webhook endpoints (now that API URL exists)

**Stripe:**
1. Stripe Dashboard → Developers → Webhooks → Add endpoint
2. URL: `https://YOUR_APPRUNNER_URL/api/webhooks/stripe`
3. Events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
4. Copy the signing secret (`whsec_...`)
5. Update Secrets Manager: `antivaxxer/prod/stripe-webhook-secret` → paste
6. App Runner will redeploy automatically when the secret rotates (or click "Deploy" in the service to force)

**Shippo:**
1. Shippo Dashboard → Settings → Webhooks → Add
2. URL: `https://YOUR_APPRUNNER_URL/api/webhooks/shippo`
3. Event: `track_updated`
4. No signing secret needed (Shippo doesn't sign webhooks; the code authenticates by tracking number)

---

## Stage 5 — Deploy Frontend (Amplify) + custom domain (1 hour active, 0-24 hours DNS propagation)

### 5.1 Connect Amplify to GitHub

1. Amplify Console → New app → Host web app → GitHub
2. Authorize, pick the repo, branch `main`
3. App root directory: `frontend`
4. Build settings: detected from `amplify.yml` at repo root (already configured)
5. Service role: Amplify offers to create one — accept

### 5.2 Configure Amplify env vars

Amplify Console → App settings → Environment variables. Add:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_API_URL` | `https://api.antivaxxer.com/api` (or App Runner URL until custom domain live) |
| `NEXT_PUBLIC_SITE_URL` | `https://antivaxxer.com` |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_...` for now (swap to `pk_live_` at final smoke test) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | from Cloudflare 1.3 |
| `NEXT_PUBLIC_GA4_ID` | from Google Analytics (optional) |
| `NEXT_PUBLIC_COOKIESYES_ID` | from CookieYes (optional) |
| `NEXTAUTH_URL` | `https://antivaxxer.com` |
| `NEXTAUTH_SECRET` | reference Secrets Manager `antivaxxer/prod/nextauth-secret` (Amplify supports SSM references) |

**Important:** confirm the production env does NOT have `STRIPE_API_BASE`, `SES_ENDPOINT`, or `MAILCHIMP_BASE_URL`. Those route to local mocks.

### 5.3 First deploy

Amplify auto-deploys after env vars are set. Watch the build log in the console. Should take 3-5 min.

If the build fails: most common cause is missing `NEXT_PUBLIC_*` env vars. Add the missing one and redeploy.

### 5.4 Test the deployed frontend

1. Visit the Amplify-provided URL (looks like `https://main.d1234.amplifyapp.com`)
2. Browse `/shop` — products should load (proves API connection works)
3. Try a test order with Stripe test card `4242 4242 4242 4242` — payment should succeed and you should land on `/checkout/confirmation`

If the order page loads but checkout fails: API is reachable but probably has env var issues. Check App Runner logs.

### 5.5 Custom domain

1. Amplify Console → Domain management → Add domain
2. Domain: `antivaxxer.com` (root) + `www.antivaxxer.com` (subdomain)
3. Amplify gives you DNS records to add — add them to your DNS provider
4. SSL certificate is auto-provisioned (Amplify uses ACM)
5. Wait for DNS propagation (5 min - 24 hours)
6. **Add a CNAME for `api.antivaxxer.com` → App Runner URL** (you can use Route 53 alias or any registrar's CNAME)

Once DNS propagates, update:
- App Runner env: `FRONTEND_URL=https://antivaxxer.com`, `NEXTAUTH_URL=https://antivaxxer.com`
- Amplify env: `NEXT_PUBLIC_API_URL=https://api.antivaxxer.com/api`
- Secrets Manager: `antivaxxer/prod/site-url=https://antivaxxer.com`
- Both services redeploy

---

## Stage 6 — First admin user + cron + final smoke test (1 hour)

### 6.1 First admin user (CRITICAL)

The admin frontend gate refuses access without a user whose `role='admin'`. Without this step, no one can use `/admin`.

1. Visit `https://antivaxxer.com/account/register`, register with your admin email
2. Welcome email arrives if SES is configured correctly (1.1, 1.2 done)
3. Connect to RDS and promote:

```bash
# Connect via psql (you may need a bastion host or SSH tunnel since RDS is private)
psql <database-url>

# Then:
SELECT id, email, role FROM users WHERE email = 'your-admin@antivaxxer.com';
UPDATE users SET role = 'admin' WHERE email = 'your-admin@antivaxxer.com';
```

4. Log out of the site, log back in (the JWT needs to be reissued with the new role)
5. Navigate to `/admin` — you should see the dashboard

If you get a 404 or "Access denied": role didn't update or you didn't re-login.

### 6.2 Remove `ADMIN_TOKEN` if it exists

If you set `ADMIN_TOKEN` anywhere in env (it's a legacy bootstrap fallback), delete it now. The code falls back to JWT-only auth.

### 6.3 Cron job for abandoned cart recovery (EventBridge + Lambda)

1. Lambda Console → Create function
2. Author from scratch, runtime Node.js 20.x
3. Function name: `antivaxxer-cron-abandoned-carts`
4. Execution role: `antivaxxer-cron-lambda-role` (from 2.4)
5. Function code:

```javascript
exports.handler = async () => {
  const url = `${process.env.API_URL}/api/admin/cron/abandoned-carts`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${process.env.CRON_TOKEN}` },
  });
  const result = await response.json();
  console.log('Cron result:', JSON.stringify(result));
  if (!response.ok) throw new Error(`Cron failed: ${response.status}`);
  return result;
};
```

6. Environment variables on the Lambda:
   - `API_URL=https://api.antivaxxer.com`
   - `CRON_TOKEN` → reference Secrets Manager `antivaxxer/prod/cron-token`
7. EventBridge → Create rule
   - Rule name: `antivaxxer-cron-abandoned-carts-rule`
   - Schedule: `cron(*/30 * * * ? *)` (every 30 min)
   - Target: the Lambda above

### 6.4 Switch to Stripe live keys (if you haven't already)

1. Update `antivaxxer/prod/stripe-secret-key` → `sk_live_...`
2. Update Amplify env `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` → `pk_live_...`
3. Stripe Dashboard → Developers → Webhooks → recreate the production webhook with live keys
4. Update `antivaxxer/prod/stripe-webhook-secret` with the new live signing secret
5. Force redeploy on App Runner and Amplify

### 6.5 Final smoke test (the moment of truth)

Do this with a real card. Plan to refund yourself.

- [ ] Register a fresh test account at `/account/register` (Turnstile widget appears, button disabled until verified)
- [ ] Welcome email arrives within 30 seconds
- [ ] Browse `/shop`, add a real product to cart
- [ ] Proceed to `/checkout`, enter shipping details
- [ ] Complete payment with a real card for $1.00 (or whatever)
- [ ] Order transitions to `processing` within 5 seconds (check `/admin/orders`)
- [ ] Order confirmation email arrives within 30 seconds
- [ ] Operations email arrives at `INVENTORY_ALERT_EMAIL` with packing slip
- [ ] In `/admin/orders/<id>`, fetch Shippo rates, purchase a label
- [ ] Customer receives shipping notification email with tracking link
- [ ] Mark tracking as `DELIVERED` in Shippo test UI (or use real shipment)
- [ ] Order auto-transitions to `delivered` in `/admin/orders/<id>`
- [ ] Delivery confirmation email arrives
- [ ] Refund the order from `/admin/orders/<id>`
- [ ] Stripe processes refund, order shows `refunded`
- [ ] Inventory restocks correctly (check `/admin/inventory`)

If all 13 boxes check, **you are launched**.

---

## Stage 7 — Post-launch monitoring (first 7 days)

Watch daily:

- **Stripe Dashboard → Webhooks** — confirm 100% success rate. Failures show in `/admin/failed-webhooks`.
- **CloudWatch Logs** — search App Runner logs for `level=error` (structured JSON from v5.4.4). Each error has a `requestId` you can give to a customer for support.
- **`/admin/dashboard`** — daily order count, low-stock alerts, abandoned cart count.
- **AWS SES → Reputation dashboard** — bounce rate <5%, complaint rate <0.1%.
- **`/admin/failed-webhooks`** — should be empty. If anything appears, click Retry. If retry fails, investigate before clicking Resolve.
- **CloudWatch billing alarm** — confirm spend matches estimate

---

## Estimated monthly cost (after launch, low-volume)

| Service | Cost |
|---|---|
| Amplify Hosting | $0-15 |
| App Runner (1 instance, 0.25 vCPU) | $25-45 |
| RDS PostgreSQL (db.t4g.micro) | $13 |
| S3 + CloudFront | $2-5 |
| SES (transactional, low volume) | $0 (free tier covers ~62k emails/mo) |
| Secrets Manager (15 secrets) | $6 |
| Lambda + EventBridge (cron) | $0 (free tier) |
| Route 53 (if used) | $0.50/zone |
| Data transfer | $1-5 |
| **Total** | **~$50-90/mo** at launch |

Add Stripe transaction fees (2.9% + $0.30/order) and Stripe Tax fees (~$1/state/mo) on top.

---

## Rollback procedures

| Scenario | Action |
|---|---|
| Bad code deploy on API | App Runner Console → Deployments → click previous deployment → "Promote" |
| Bad code deploy on frontend | Amplify Console → Deployment history → previous build → "Redeploy this version" |
| Bad migration | RDS automated backups (7-day retention) → restore to point in time. Manual `prisma migrate resolve --rolled-back` if needed. |
| Stripe webhook signature mismatch | Old webhook secret saved? Revert. Otherwise create new endpoint in Stripe and update Secrets Manager. |
| First admin user lost access | Connect to RDS, re-promote in SQL. JWT lifetime is 7d so old tokens may need to expire. |

---

## What to do when something breaks

1. **Check `/admin/failed-webhooks` first** — most critical-path issues land there
2. **Check CloudWatch for `level=error` JSON logs** — every error has a `requestId` you can quote in support
3. **Roll back code** — see procedures above
4. **Worst case:** the v5.4.0 release was the last "feature" release. Everything after is hardening, fixes, observability, tests, docs. v5.4.0 alone is launch-capable if you need to roll back further.

---

## Cross-references

- Original detailed AWS guide (12 phases): `docs/AMPLIFY_DEPLOYMENT_GUIDE.md`
- Operator setup tasks (without AWS-specific steps): `docs/PRE_LAUNCH_CHECKLIST.md`
- Per-deploy checklist (build/migrate/restart): `docs/DEPLOYMENT_GUIDE.md`
- System architecture + feature reference: `docs/SITE_WORKFLOW_SPEC.md`
- Local dev setup: `docs/SETUP.md`
