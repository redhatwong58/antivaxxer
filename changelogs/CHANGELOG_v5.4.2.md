# v5.4.2 — Honesty fixes + Stripe SDK hardening

**Release:**
**Tracking:** [AV-061]
**Migration required:** NO

> Reconstructed during v5.5.1 handover bundle pass.

## Summary

Stop lying to users + make Stripe calls fail fast.

### Newsletter API stops lying on failure
**Before:** catch block returned `{ subscribed: true }` even when Mailchimp was down. Users thought they were on the list when they weren't.
**After:** returns `{ subscribed: false }` with 502 status and honest message.

### NewsletterSection + PromoPopup check res.ok
**Before:** showed "Thank you!" on network error and hid the form. No way to retry.
**After:** check `res.ok && data.subscribed`, show error inline, form stays visible for retry, loading state on button.

### Stripe SDK centralized with timeout + retry
**Before:** `require('stripe')(key)` duplicated in 3 files with default 80s timeout, no retries. A hung Stripe call would hold an Express handler for 80s.
**After:** single `api/src/lib/stripe.js` with `timeout: 10000` and `maxNetworkRetries: 2`. All 3 route files import from there.

## Files changed

- `api/src/routes/newsletter.js` — catch block returns 502 + subscribed:false
- `api/src/lib/stripe.js` — NEW centralized Stripe init
- `api/src/routes/checkout.js` — imports from lib/stripe
- `api/src/routes/admin.js` — imports from lib/stripe
- `api/src/routes/webhooks.js` — imports from lib/stripe
- `frontend/src/components/home/NewsletterSection.js` — res.ok check + error display
- `frontend/src/components/home/PromoPopup.js` — res.ok check + error display

## Validation

- Parse: 7/7 PASS
- Structural QA: 30/30 effective PASS
