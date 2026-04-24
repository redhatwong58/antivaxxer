# ANTIVAXXER — Pre-Launch Checklist

**For:** the operator deploying to production for the first time
**Last updated:** v5.4.7
**Time required:** ~3-5 hours of active work + 24-48 hours waiting for AWS SES approval

This document consolidates every operator action that must happen between
"the code is done" and "real customers can place real orders." Every item
here is **outside the scope of the codebase** — it's account setup,
third-party configuration, or one-time bootstrap work.

The codebase itself is complete. None of these items require code changes.
If any item below is unclear, the corresponding section of `SITE_WORKFLOW_SPEC.md`
or `DEPLOYMENT_GUIDE.md` has the deeper context.

---

## Section A — Things that have a wall-clock waiting period (start these FIRST)

### A1. Request AWS SES production access
**Why:** SES sandbox mode only sends to verified addresses. Without production
access, real customers won't receive order confirmations, password resets, or
shipping notifications.
**Wait time:** 24-48 hours for AWS approval.
**How:** AWS Console → SES → Account dashboard → "Request production access".
Provide a brief description of email use cases (transactional only, no
marketing). Approval is usually fast for transactional use.
**Verification:** SES dashboard shows "Production access" instead of "Sandbox".

### A2. Verify the sending domain in SES
**Why:** `SES_FROM_EMAIL` must be from a verified domain. Without DKIM/SPF
records, emails land in spam.
**How:** SES → Verified identities → Create identity → Domain → Add the
generated DKIM CNAME records to your DNS. Verification usually completes
within 30 minutes once DNS propagates.

### A3. Cloudflare Turnstile site setup
**Why:** Bot protection on register and login forms. The codebase wiring is
complete (v5.4.6) but needs Cloudflare credentials.
**How:** Cloudflare Dashboard → Turnstile → Add Site
- Site name: `antivaxxer-prod`
- Domain: `antivaxxer.com` (and any preview domains)
- Widget mode: **Managed** (lowest user friction)
- Copy the **Site Key** → set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Amplify env
- Copy the **Secret Key** → set `TURNSTILE_SECRET_KEY` in App Runner env
  (or store in Secrets Manager as `antivaxxer/prod/turnstile-secret`)

> If both env vars are unset, the system gracefully degrades and forms still
> work without bot protection. Useful for staging environments.

---

## Section B — Stripe configuration (do AFTER A is in flight)

### B1. Switch to live Stripe keys
**Why:** Test keys won't process real payments.
**How:** Stripe Dashboard → Developers → API keys → reveal live keys.
Update env vars:
- `STRIPE_SECRET_KEY` (App Runner) — live `sk_live_...`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (Amplify) — live `pk_live_...`

### B2. Configure Stripe webhook endpoint
**Why:** Without this, payments succeed but orders never transition from
`pending → processing` and customers don't get confirmation emails.
**How:** Stripe Dashboard → Developers → Webhooks → Add endpoint
- URL: `https://api.antivaxxer.com/api/webhooks/stripe`
- Events: `payment_intent.succeeded`, `payment_intent.payment_failed`,
  `charge.refunded`
- After creation, reveal the **Signing secret** (`whsec_...`)
- Set `STRIPE_WEBHOOK_SECRET` in App Runner env

**Verification:** Place a test order with a real card for $1.00. Order should
transition to `processing` within 5 seconds and you should receive a
confirmation email. Then refund yourself.

### B3. Activate Stripe Tax (optional but recommended)
**Why:** Without this, all orders ship at $0 tax. The code (v5.3.8) sends
`automatic_tax: { enabled: true }` to Stripe but this is a no-op until you
activate Tax in the dashboard and register for the US states where you have
nexus.
**How:** Stripe Dashboard → Settings → Tax → Activate Stripe Tax. Add
registrations for relevant states. There is a small monthly fee per state.

---

## Section C — Shippo configuration

### C1. Set the Shippo API key
**Why:** Without it, the admin order page can't fetch shipping rates or
purchase labels — fulfillment falls back to manual.
**How:** Shippo Dashboard → API → API keys → copy the production key.
Set `SHIPPO_API_KEY` in App Runner env (or store in Secrets Manager as
`antivaxxer/prod/shippo-api-key`).

### C2. Set the Shippo sender address
**Why:** Required for label purchase. Defines the "from" address on every
shipping label.
**How:** Set in App Runner env:
- `SHIPPO_FROM_NAME=ANTIVAXXER Fulfillment`
- `SHIPPO_FROM_STREET=...`
- `SHIPPO_FROM_CITY=...`
- `SHIPPO_FROM_STATE=...` (2-letter)
- `SHIPPO_FROM_ZIP=...`
- `SHIPPO_FROM_COUNTRY=US`

### C3. Configure Shippo tracking webhook
**Why:** Without this, orders never auto-transition from `shipped → delivered`
and customers don't receive delivery confirmation emails.
**How:** Shippo Dashboard → Settings → Webhooks → Add webhook
- URL: `https://api.antivaxxer.com/api/webhooks/shippo`
- Event: `track_updated`
- (No signing secret — Shippo doesn't sign webhooks. The code authenticates
  via the order's `shippoTrackingNumber` instead.)

**Verification:** Buy a test label, mark a tracking event as `DELIVERED` in
the Shippo test UI. Order should auto-transition to `delivered` and the
customer should receive a delivery confirmation email.

---

## Section D — Database + auth bootstrap

### D1. Run all Prisma migrations
    cd api
    DATABASE_URL=<production_url> npx prisma migrate deploy

**Verification:** All tables exist including `failed_webhooks` (v5.3.9) and
the Shippo columns on `orders` (v5.4.0).

### D2. Create the first admin user
**Why:** The admin frontend gate (v5.3.5) refuses access without a user
whose `role='admin'`. Without this, no one can use `/admin`.

**Step 1:** Register a normal account through `/account/register` using your
admin email. This creates the user + sends the welcome email.

**Step 2:** Connect to the production database and promote the account:

    -- Find your user ID
    SELECT id, email, role FROM users WHERE email = 'admin@antivaxxer.com';

    -- Promote to admin
    UPDATE users SET role = 'admin' WHERE email = 'admin@antivaxxer.com';

**Verification:** Log out, log back in, navigate to `/admin`. You should see
the admin dashboard. If you see a 404 or "Access denied", the role didn't
update — check the JWT was reissued (logging out and back in is required
because the role is baked into the JWT).

### D3. Remove the legacy `ADMIN_TOKEN` env var
**Why:** It's a bootstrap fallback for the very first deploy when no admin
users exist. Once a real admin user is created (D2), it becomes a security
risk — anyone with the token has full admin API access without an audit
trail.
**How:** Delete `ADMIN_TOKEN` from App Runner env vars. The admin auth
middleware will fall back to JWT-only authentication.

---

## Section E — Cron / scheduled jobs

### E1. Generate `CRON_TOKEN`
    openssl rand -base64 32

Set it in App Runner env (or store in Secrets Manager as
`antivaxxer/prod/cron-token`).

### E2. Configure a scheduler to invoke the abandoned cart cron
**Why:** Without this, abandoned cart recovery emails never send.
**Endpoint:** `POST https://api.antivaxxer.com/api/admin/cron/abandoned-carts`
**Auth:** `Authorization: Bearer <CRON_TOKEN>`
**Frequency:** every 30 minutes is plenty (the email itself only fires for
carts older than `ABANDONED_CART_DELAY_MS`, default 1 hour).

**Three options** (pick whichever your hosting platform supports easiest):

**Option 1 — AWS EventBridge + Lambda** (if you're on App Runner)
Copy the 10-line Lambda from `SITE_WORKFLOW_SPEC.md` section 10.3 into the
AWS Lambda console. Set EventBridge rule with cron expression
`cron(*/30 * * * ? *)`.

**Option 2 — Render or Railway built-in cron**
Use the platform's native cron job service. Set schedule `*/30 * * * *` and
command:
    curl -X POST -H "Authorization: Bearer $CRON_TOKEN" \
      https://api.antivaxxer.com/api/admin/cron/abandoned-carts

**Option 3 — Vercel Cron** (if frontend is on Vercel)
Add `vercel.json`:
    { "crons": [{ "path": "/api/cron/abandoned-carts", "schedule": "*/30 * * * *" }] }
Then proxy from `/api/cron/abandoned-carts` to the API endpoint with the bearer token.

---

## Section F — Final smoke test (do this LAST, before announcing launch)

Run through the full customer journey with a real card. Plan to refund yourself
afterward.

- [ ] Register a fresh test account at `/account/register` (Turnstile widget appears, button disabled until challenge passes)
- [ ] Welcome email arrives within 30 seconds
- [ ] Browse `/shop`, add a real product to cart
- [ ] Proceed to `/checkout`, enter shipping details
- [ ] Complete payment with a real card for $1.00 (or whatever)
- [ ] Order transitions to `processing` within 5 seconds (check `/admin/orders`)
- [ ] Order confirmation email arrives within 30 seconds
- [ ] Operations email arrives at `INVENTORY_ALERT_EMAIL` with packing slip
- [ ] In `/admin/orders/<id>`, fetch Shippo rates, purchase a label
- [ ] Customer receives shipping notification email with tracking link
- [ ] Mark tracking as `DELIVERED` in Shippo test UI
- [ ] Order auto-transitions to `delivered` in `/admin/orders/<id>`
- [ ] Delivery confirmation email arrives
- [ ] Refund the order from `/admin/orders/<id>`
- [ ] Stripe processes refund, order shows `refunded`
- [ ] Inventory restocks correctly (check the variant in `/admin/inventory`)

If all 13 boxes check, **you are launched**.

---

## Section G — Post-launch monitoring (first 7 days)

Watch these dashboards daily for the first week:

- **Stripe Dashboard → Webhooks** — confirm 100% success rate. Any failures
  show up in `/admin/failed-webhooks` for manual recovery.
- **CloudWatch (or your log aggregator)** — search for `level=error` in
  structured JSON logs (v5.4.4). Each error has a `requestId` you can give
  to a customer for support.
- **`/admin/dashboard`** — daily order count, low-stock alerts, abandoned cart count.
- **AWS SES → Reputation dashboard** — bounce rate < 5%, complaint rate < 0.1%.
- **`/admin/failed-webhooks`** — should be empty. If anything appears, click
  Retry. If retry fails, investigate the underlying error before clicking Resolve.

---

## Quick reference — env vars cheat sheet

**Required for launch:**
- `DATABASE_URL`, `NEXTAUTH_SECRET`, `JWT_SECRET`, `JWT_EXPIRES`
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- `SES_FROM_EMAIL` (verified domain)
- `SHIPPO_API_KEY` + all `SHIPPO_FROM_*`
- `CRON_TOKEN`
- `S3_BUCKET_NAME`, `CLOUDFRONT_DOMAIN`
- `INVENTORY_ALERT_EMAIL`

**Bot protection (recommended):**
- `TURNSTILE_SECRET_KEY` (API)
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (frontend)

**Frontend-only:**
- `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_SITE_URL`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- `NEXT_PUBLIC_GA4_ID`, `NEXT_PUBLIC_COOKIESYES_ID`
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`

**Optional / tuning:**
- `MAILCHIMP_API_KEY` (newsletter; degrades gracefully if unset)
- `ABANDONED_CART_DELAY_MS` (default 1 hour)
- `INVENTORY_WARNING_THRESHOLD` (default 15)
- `INVENTORY_REORDER_THRESHOLD` (default 5)

**Remove after launch:**
- `ADMIN_TOKEN` — legacy bootstrap, delete once D2 is complete
