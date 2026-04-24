# v5.4.9 — E2E checkout test (Playwright + real Stripe test mode)

**Release:**
**Tracking:** [AV-068]
**Migration required:** NO

## Summary

Closes the MED "E2E test for the checkout → payment → confirmation flow"
item in GAP_TRACKER. One Playwright spec covering the full anonymous
guest journey from shop page to confirmation page, using a real Stripe
test card.

## Real Stripe vs stripe-mock — design decision

Stripe Elements (`PaymentElement`) loads `js.stripe.com` from the
browser and the payment iframe talks to `api.stripe.com` directly.
There is no offline path for the in-browser payment UI — `STRIPE_API_BASE`
only routes the SERVER-side SDK in `api/src/lib/stripe.js`.

So this test uses real Stripe test mode for the iframe. Card
`4242 4242 4242 4242` (Stripe's always-succeeds test card) only works
in test mode, so there's no risk of accidentally charging anyone.

For fully offline tests, the v5.4.5 backend integration tests at
`api/__tests__/` mock Stripe entirely.

## What's covered

The spec asserts:
1. Shop page renders products
2. Quick-add inserts item into cart
3. Cart drawer opens with the item
4. Checkout link navigates correctly
5. Step 1 (Review) → Step 2 (Address) transition
6. Address form accepts shipping data
7. Step 2 → Step 3 (Payment) — backend creates PaymentIntent
8. Stripe Elements iframe loads
9. Card details accepted by Stripe iframe
10. Payment confirmation succeeds
11. Browser lands on /checkout/confirmation with order number in URL
12. Confirmation page displays "thank you for your order"

## What's NOT covered (intentionally)

- Webhook → order status transition (covered by `api/__tests__/webhook.test.js`)
- Inventory deduction atomicity (covered by `api/__tests__/webhook.test.js`)
- Email send (covered by integration tests + manual smoke test in PRE_LAUNCH_CHECKLIST.md)
- Refund flow (covered by `api/__tests__/refund.test.js`)
- Logged-in checkout (only guest tested; the difference is the userId field on the order)

This is documented in the spec file's header comment so future devs
don't try to extend this test to cover those paths.

## Files

- `frontend/playwright.config.js` (NEW)
- `frontend/e2e/checkout.spec.js` (NEW)
- `frontend/e2e/README.md` (NEW)
- `frontend/package.json` (added `@playwright/test` + 3 test:e2e scripts)

## Validation

- Parse: 2/2 PASS
- package.json: valid JSON
- Structural QA: 30/30 PASS
- Regression: 60/60 PASS (zero existing functionality broken)

## How to run

```bash
# Prereqs:
docker compose up -d                # postgres + mocks
cd api && npm run dev               # API on :4000
cd ../frontend && npm run dev       # frontend on :3000
# Stripe test keys must be set; STRIPE_API_BASE must be UNSET

# First-time install:
cd frontend
npm install
npx playwright install chromium

# Run:
npm run test:e2e          # headless, ~30s
npm run test:e2e:ui       # interactive UI mode
npm run test:e2e:report   # view HTML report
```

## What's left in the testing column

| Priority | Item | Status |
|---|---|---|
| MED | Component tests for admin pages (Dashboard, Inventory, Promos, Customers) | Open — last item |

After v5.5.0 ships that, the entire testing column from GAP_TRACKER
section 3 will be closed.
