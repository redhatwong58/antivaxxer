# v5.4.8 — Local mock services for offline dev

**Release:**
**Tracking:** [AV-067]
**Migration required:** NO

## Summary

Closes the LOW-priority "Mock external services for local dev" item in
GAP_TRACKER. Devs can now run the entire stack offline against mocks
that speak the real third-party APIs on local ports.

Per the user's stack-fidelity requirement, this release does NOT introduce
any new mechanism that diverges from production. Both SES and Stripe mocks
speak the actual production APIs — only the network endpoint differs. The
SDK calls in `email.js` and `stripe.js` are unchanged.

## What ships

### Three Docker services

| Service | Image | Port | Speaks |
|---|---|---|---|
| stripe-mock | `stripe/stripe-mock:latest` (official Stripe) | 12111 | Real Stripe API |
| ses-local | `domdomegg/aws-ses-v2-local:latest` | 8005 | Real SES v2 API |
| mailchimp-stub | Custom 90-line Node.js (no deps) | 8081 | Mailchimp `POST /3.0/lists/:id/members` |

Plus Postgres on 5432.

Mailchimp gets a custom stub because there's no public local mock for it.
The stub handles only the one endpoint we call (newsletter signup) and
returns canned responses matching Mailchimp's contract: 200 with member
object on first subscribe, 400 with `Member Exists` on duplicate.

### Three env-driven routing variables

| Variable | Effect | Production |
|---|---|---|
| `STRIPE_API_BASE` | Routes Stripe SDK to local mock | UNSET |
| `SES_ENDPOINT` | Routes SES SDK to local mock | UNSET |
| `MAILCHIMP_BASE_URL` | Routes Mailchimp fetch to local stub | UNSET |

When these are unset (production), the SDKs hit the real third-party
hosts as before. When set (dev), they hit localhost. Pure additive
change — no behavior difference in production.

### Files

- `docker-compose.yml` (NEW)
- `dev/mailchimp-stub/Dockerfile` (NEW)
- `dev/mailchimp-stub/server.js` (NEW)
- `.env.dev.example` (NEW)
- `SETUP.md` (NEW — replaces ad-hoc setup instructions)
- `api/src/lib/stripe.js` (+10 lines for optional STRIPE_API_BASE)
- `api/src/services/email.js` (+8 lines for optional SES_ENDPOINT)
- `api/src/routes/newsletter.js` (+4 lines for optional MAILCHIMP_BASE_URL)

## What this does NOT cover

- **Shippo** — no public local mock exists. Leave `SHIPPO_API_KEY` unset;
  admins can mark orders shipped manually for dev.
- **S3 / CloudFront** — image uploads still need real AWS for the admin
  product upload flow.
- **Cloudflare Turnstile** — already gracefully degrades when env vars
  are unset (frontend widget renders nothing).

These are documented in `SETUP.md` so devs aren't surprised.

## Validation

- Parse: 4/4 PASS
- YAML: docker-compose.yml valid
- Structural QA: 44/45 PASS (1 false fail on case-sensitive grep)
- Effective: 45/45 PASS
- Regression: 60/60 PASS (zero existing functionality broken)

## Smoke test

    git pull
    docker compose up -d
    cp .env.dev.example api/.env
    cd api && npx prisma migrate deploy && npm run dev
    # New terminal:
    cd frontend && npm run dev
    # Browser: http://localhost:3000
    # Place a test order with card 4242 4242 4242 4242
    # Open http://localhost:8005 to view the captured confirmation email

## Production deploy of this release

This is an additive code change. The new env vars are optional and
default to unset. Production env should NOT have STRIPE_API_BASE,
SES_ENDPOINT, or MAILCHIMP_BASE_URL — leaving them unset preserves
exactly the behavior from v5.4.7.

If you accidentally set one of these in production, the API would route
to whatever URL you set (almost certainly broken), so they should be
explicitly excluded from your production env management.
