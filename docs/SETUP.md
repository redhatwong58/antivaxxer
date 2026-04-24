# ANTIVAXXER — Local Development Setup

**Version:** v5.4.8
**For:** developers running the project locally for the first time

This guide gets the full stack running on your laptop with zero internet
dependency on third-party services. The recommended dev workflow uses
Docker Compose to run Postgres + mock Stripe + mock SES + a Mailchimp
stub. All mocks speak the real third-party APIs on local ports — production
SDK code works against them unchanged.

If you'd rather skip Docker and use real test-mode credentials for everything,
that still works (each mock is opt-in via env vars). The Docker path is
just faster and works offline.

---

## Prerequisites

- Node.js 20+ and npm
- Docker Desktop (for the recommended dev workflow)
- Git

## 1. Clone and install

    git clone <repo>
    cd antivaxxer
    npm install --workspaces

## 2. Start the local services

    docker compose up -d

This brings up four containers:

| Service | Port | Purpose |
|---|---|---|
| `postgres` | 5432 | Database — matches the Prisma schema |
| `stripe-mock` | 12111 | Official Stripe Docker image — speaks real Stripe API |
| `ses-local` | 8005 | aws-ses-v2-local — speaks real SES v2 API; web UI at http://localhost:8005 |
| `mailchimp-stub` | 8081 | Tiny Express stub for the one Mailchimp endpoint we use |

Verify they're healthy:

    docker compose ps

## 3. Configure environment

    cp .env.dev.example api/.env

Open `api/.env` and confirm the routing variables are set:

- `STRIPE_API_BASE=http://localhost:12111`
- `SES_ENDPOINT=http://localhost:8005`
- `MAILCHIMP_BASE_URL=http://localhost:8081`

These tell the SDKs to hit the local mocks. **Production leaves all
three unset** — the SDKs default to the real third-party hosts.

## 4. Run database migrations

    cd api
    npx prisma migrate deploy
    npx prisma db seed   # optional: loads sample products

## 5. Start the API

    cd api
    npm run dev

The API listens on http://localhost:4000.

You should see startup logs:

    [STRIPE] Using local mock at http://localhost:12111
    [EMAIL] Using local SES mock at http://localhost:8005
    Server listening on :4000

## 6. Start the frontend (new terminal)

    cd frontend
    npm run dev

Frontend at http://localhost:3000.

## 7. Verify the stack

Place a test order:

1. Visit http://localhost:3000/shop and add a product to cart
2. Proceed through checkout
3. Use the Stripe test card `4242 4242 4242 4242`, any future expiry, any CVC
4. Submit payment
5. Order confirmation page should appear

Then verify each mock captured what it should:

- **Stripe:** `docker compose logs stripe-mock | tail -20` — should show the PaymentIntent create + confirm
- **SES:** open http://localhost:8005 in a browser — should see the order confirmation email rendered with HTML
- **Mailchimp** (only if you tested newsletter signup): `docker compose logs mailchimp-stub` — should show the subscribe call

## Stopping

    docker compose down       # stops services, keeps DB data
    docker compose down -v    # stops services AND wipes DB data

---

## Working without Docker

You don't have to use Docker. If you'd rather hit real Stripe test mode and
real SES sandbox, just unset the routing variables in `api/.env` and provide
real credentials:

    # STRIPE_API_BASE=...   ← comment out or delete
    STRIPE_SECRET_KEY=sk_test_<your_real_test_key>

    # SES_ENDPOINT=...      ← comment out or delete
    SES_FROM_EMAIL=<your_verified_sandbox_address>
    AWS_ACCESS_KEY_ID=<your_real_key>
    AWS_SECRET_ACCESS_KEY=<your_real_secret>

    # MAILCHIMP_BASE_URL=... ← comment out or delete
    MAILCHIMP_API_KEY=<your_real_key>

The SDKs detect the unset routing variables and go to production hosts.

---

## Common issues

**Postgres "connection refused"** — wait 5 seconds after `docker compose up`
for the DB to finish starting, or check `docker compose ps` to see the
health status.

**`STRIPE_API_BASE` set but Stripe calls still hit api.stripe.com** — check
the API startup logs for `[STRIPE] Using local mock`. If the line is missing,
the env var didn't load. Confirm `api/.env` exists and the API was restarted
after editing it.

**Emails not appearing in the SES UI** — the API logs `Skipping confirmation
email` when `SES_FROM_EMAIL` is unset. Make sure it's set to anything
(e.g. `dev@antivaxxer.local`) in `api/.env`.

**Port conflicts** — if 5432, 12111, 8005, or 8081 are in use, edit the
port mappings in `docker-compose.yml`. Then update the matching variables
in `api/.env`.

**Wiping and starting over** — `docker compose down -v && docker compose up -d`,
then re-run the migrations.

---

## What this dev environment does NOT cover

- **Shippo** — no public local mock exists. Leave `SHIPPO_API_KEY` unset; the
  admin "Get Rates" button will show a clear error and admins can mark orders
  shipped manually. Set a real `SHIPPO_API_KEY` (test mode) when working on
  shipping features.
- **S3 / CloudFront** — image uploads will fail without real AWS credentials.
  This affects only the admin product upload flow. Use a real S3 bucket
  (test) when working on image features.
- **Cloudflare Turnstile** — leave `TURNSTILE_SECRET_KEY` unset. The frontend
  widget renders nothing and forms remain submittable.

For a complete production deploy, see `PRE_LAUNCH_CHECKLIST.md`.
