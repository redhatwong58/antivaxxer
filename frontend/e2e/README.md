# E2E Tests — ANTIVAXXER

[AV-068] v5.4.9 — browser-based end-to-end tests using Playwright.

## What's covered

| Spec | Journey | Time |
|---|---|---|
| `checkout.spec.js` | Anonymous guest: shop → cart → 3-step checkout → real Stripe payment → confirmation | ~30s |

## Prerequisites

Three terminals running before you can execute tests:

```bash
# Terminal 1 — local services (postgres + mocks)
docker compose up -d

# Terminal 2 — API server
cd api && npm run dev

# Terminal 3 — Frontend server
cd frontend && npm run dev
```

Plus, **Stripe TEST mode keys** in your env (NOT live, NOT stripe-mock):

- `STRIPE_SECRET_KEY=sk_test_...` in `api/.env`
- `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...` in your shell or frontend env
- `STRIPE_API_BASE` UNSET (so the SDK hits real Stripe test mode)

The test uses card `4242 4242 4242 4242` — Stripe's always-succeeds test
card. It only works in test mode.

Why real Stripe instead of stripe-mock? Stripe Elements (the in-browser
payment iframe) loads `js.stripe.com` and talks to `api.stripe.com`
directly from the browser. There is no offline path for the iframe — it's
owned by Stripe and we can't intercept it. Server-side Stripe calls
(PaymentIntent creation) still go through `api/src/lib/stripe.js` which
respects `STRIPE_API_BASE`, but the browser-side checkout absolutely
requires real Stripe.

For tests that work fully offline, see `api/__tests__/` (Jest +
supertest) which mock the Stripe SDK entirely.

## Running

First-time setup:

```bash
cd frontend
npm install
npx playwright install chromium    # downloads the browser binary
```

Run the test:

```bash
npm run test:e2e            # headless
npm run test:e2e:ui         # interactive UI mode (recommended for debugging)
npm run test:e2e:report     # view HTML report after a run
```

## What this test does NOT cover

The webhook → order status transition is intentionally OUT OF SCOPE here.
Stripe's test card succeeds in the browser, but the webhook delivery to
`http://localhost:4000/api/webhooks/stripe` requires `stripe listen` (the
Stripe CLI) to be forwarding events. Setting that up adds dependencies
without much marginal value — the webhook handler already has its own
integration tests in `api/__tests__/webhook.test.js` that cover all the
edge cases (atomicity, idempotency, insufficient stock, missing variant,
etc.) using mocks.

So this E2E test asserts that the user lands on the confirmation page
with a valid order number in the URL. The order's actual status
transition from `pending → processing` happens whenever the webhook
arrives — it doesn't affect the confirmation page user experience.

## Failures

Common failure modes and what they mean:

| Symptom | Likely cause |
|---|---|
| `expect(productLink).toBeVisible` timeout | API down OR no products seeded — run `npx prisma db seed` |
| Stripe iframe never appears | `STRIPE_API_BASE` is set, routing browser PaymentIntent to stripe-mock — unset it |
| Card field fill fails | Wrong key type — `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` must start with `pk_test_` |
| Confirmation page never loads | PaymentIntent succeeded but webhook secret mismatch or backend error — check API logs |

Trace + screenshot + video are saved to `playwright-report/` on failure.
Run `npm run test:e2e:report` to view.
