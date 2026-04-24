# ANTIVAXXER — Error Handling Audit & Feature Gap Tracker

**Generated:**
**Trigger:** User feedback: "if there is not good error handling this needs to be addressed. Further continue to track any feature gaps or not committed work."
**Audited against:** v5.3.8 codebase
**Author note:** This doc supersedes the loose gap notes in SITE_WORKFLOW_SPEC.md section 14 by adding the error-handling findings. The workflow spec gap list is still authoritative for *feature* gaps; this doc adds *quality* gaps and tracks *uncommitted/blocked* work.

---

## Section 1 — Error Handling Audit

### Summary

| Layer | Coverage | Critical issues | High issues | Medium issues |
|---|---|---|---|---|
| API route handlers | 42/42 have try/catch + next(error) | 0 | 2 | 1 |
| Webhook handler | Has try/catch | **1** | **1** | 0 |
| Frontend fetch calls | 26 audited, ~7 confirmed issues | 0 | 2 | 5 |
| Global error middleware | Present but basic | 0 | 0 | 2 |
| Database transactions | Some atomic, some not | **1** | 0 | 0 |

Two **CRITICAL** issues found. Both are pre-existing (predate this session) and known on the roadmap, but they need to be flagged here too because they're real.

---

### CRITICAL #1 — ~~Stripe webhook inventory deduction is not atomic~~ ✅ FIXED in v5.3.9

**File:** `api/src/routes/webhooks.js:109-141` (pre-v5.3.9)
**Status:** Fixed in v5.3.9 — wrapped in `prisma.$transaction` with `SELECT FOR UPDATE` row locks.

**The fix (v5.3.9):**
- The entire payment success flow (order status update + all variant decrements) now runs inside a single `prisma.$transaction(async (tx) => { ... })` interactive transaction.
- Each variant row is locked with `tx.$queryRaw\`SELECT id, stock_qty FROM variants WHERE id = ${variantId} FOR UPDATE\`` before decrementing. This serializes concurrent orders for the same variant, preventing oversell.
- The order row is locked with `SELECT id, status FROM orders WHERE id = ${orderId} FOR UPDATE` and the status is re-checked inside the transaction. This prevents duplicate webhook deliveries from both processing the same order.
- If any step fails (variant not found, insufficient stock, DB error), the entire transaction rolls back — no half-applied state. The error is caught by the outer try/catch, written to the FailedWebhook DLQ, and an admin alert email is sent.

**Schema verification (v5.3.9 audit):**
The raw SQL uses Postgres column names (not Prisma model field names), which must match the `@map()` annotations. All 6 references were verified:
- `FROM orders` → `@@map("orders")` ✓
- `orders.id` → no `@map()` → literal `id` ✓
- `orders.status` → no `@map()` → literal `status` ✓
- `FROM variants` → `@@map("variants")` ✓
- `variants.id` → no `@map()` → literal `id` ✓
- `variants.stock_qty` → `@map("stock_qty")` ✓

**⚠ Prisma `$queryRaw` risk callout:**

The `SELECT FOR UPDATE` row locks use Prisma's `$queryRaw` tagged template literals, which:
1. **Parameterize values automatically** — `${order.id}` becomes `$1` in the prepared statement. SQL injection is not a risk.
2. **Run inside interactive transactions** — `tx.$queryRaw` executes within the `$transaction` scope. Row locks are transaction-scoped and release on commit/rollback. This is Prisma's documented and supported pattern.
3. **Bypass Prisma's type checking** — unlike `tx.order.findUnique()`, raw queries don't get compile-time type validation. If the schema changes (e.g., a column rename via `@map()` or a table rename), the raw SQL will break silently at runtime with a Postgres error like `column "stock_qty" does not exist`.

**Recommended safeguard:** add a smoke test that runs the transaction against a test database:
```js
// test: verify row lock queries execute successfully
const result = await prisma.$transaction(async (tx) => {
  const orders = await tx.$queryRaw`SELECT id, status FROM orders LIMIT 1`;
  const variants = await tx.$queryRaw`SELECT id, stock_qty FROM variants LIMIT 1`;
  return { orders, variants };
});
assert(result.orders !== undefined);
assert(result.variants !== undefined);
```
This test should run as part of the deploy smoke test (after migration, before traffic). If either query fails, the column names in webhooks.js need updating to match the new schema. Add this to the deployment checklist in `DEPLOYMENT_GUIDE.md` and `AMPLIFY_DEPLOYMENT_GUIDE.md`.

**If Prisma ever adds native row-level locking** (there's an open feature request), this raw SQL should be migrated to the native API to get type safety back. Until then, the raw SQL is the correct and documented approach.

---

### CRITICAL #2 — ~~Webhook errors are silently swallowed (no dead-letter queue)~~ ✅ FIXED in v5.3.9

**File:** `api/src/routes/webhooks.js:67-75` (pre-v5.3.9)
**Status:** Fixed in v5.3.9 — failed events are now written to the `FailedWebhook` table (dead-letter queue), an admin alert email is sent via SES, and a new admin page at `/admin/failed-webhooks` lets ops view, retry, or manually resolve failed events.

**What was added:**
1. **DLQ write** — in the webhook outer catch, `prisma.failedWebhook.create()` stores the full event payload + error message.
2. **Admin alert email** — `sendWebhookFailureAlert()` fires immediately with a styled email that warns ops about potential money loss (especially for `payment_intent.succeeded` failures).
3. **Admin DLQ page** — `/admin/failed-webhooks` with unresolved list, expandable payload viewer, Retry button (replays event through handler), Resolve button (manual mark). Shows retry count and resolved-by label.
4. **Admin DLQ endpoints** — `GET /failed-webhooks`, `GET /failed-webhooks/:id`, `POST /failed-webhooks/:id/retry`, `POST /failed-webhooks/:id/resolve`.
5. **Sidebar nav** — "DLQ" link added to the admin sidebar.
6. **Enhanced sig failure logging** — IP, signature prefix (truncated), and body length for forgery investigation.

**DLQ write failover:** if the DLQ write itself fails (DB is completely down), a FATAL-level log line is emitted with the full event ID. This is the absolute last resort — at that point the event is only in console logs. Recommended: set up a CloudWatch alarm on `[WEBHOOK] FATAL:` log lines.

**Schema:** `FailedWebhook` model added to `schema.prisma` with migration `20260415000000_add_failed_webhooks/migration.sql`. Indexed on `(resolved, createdAt)` and `(source, eventType)` for efficient querying.

---

### HIGH #1 — Newsletter subscribe lies to the user on failure

**File:** `api/src/routes/newsletter.js:71-79`
**Severity:** High (UX deception)
**Impact:** Real users who try to subscribe but hit a Mailchimp outage are told `"Thank you for subscribing!"` — they believe they're on the list, never receive the welcome email or any future content, and have no way to know it failed. They will think the newsletter just doesn't send anything.

**The current code:**
```js
} catch (error) {
  console.error('[NEWSLETTER] Mailchimp error:', error.message);
  // Don't expose Mailchimp errors to the client
  res.json({ subscribed: true, message: 'Thank you for subscribing!' });
}
```

**Recommended fix:**
1. Create a `pending_newsletter_subscriptions` table to queue failed signups
2. Insert a row when Mailchimp fails
3. A daily cron retries pending subscriptions
4. Either return the truthful "we're having issues, please try again" OR truly queue and confirm
5. In any case, **don't lie to the user**

**Workaround for now:** at least admin should be alerted (currently nothing alerts).

---

### HIGH #2 — PromoPopup newsletter signup is fire-and-forget client-side

**File:** `frontend/src/components/home/PromoPopup.js:26-35`
**Severity:** High (UX deception, mirrors HIGH #1)

**The current code:**
```js
try {
  await fetch(`${API_URL}/newsletter/subscribe`, { ... });
} catch { /* silent */ }
setSubmitted(true);
setTimeout(close, 2000);
```

User sees "submitted" success even if the API call failed entirely, the network is down, or the response was an error. No `res.ok` check. Combined with HIGH #1 (the API also silently swallows), there is **no path** by which a failed signup reaches anyone's attention.

**Fix:** check `res.ok`, show "we're having trouble — try again" on failure, and keep the modal open so the user can retry.

---

### HIGH #3 — Wishlist sync fetches are fire-and-forget on the client

**File:** `frontend/src/components/wishlist/WishlistContext.js:85,135,159`
**Severity:** High (data loss)

The `addToWishlist` and `removeFromWishlist` functions do optimistic UI updates, then fire a background fetch with no error handling, no retry, and no user notification on failure:

```js
if (isLoggedIn) {
  try {
    await fetch(`${API_URL}/account/wishlist/${productId}`, { ... });
  } catch (e) {
    // Silent failure — local state still shows the heart as filled
  }
}
```

**The bug:** if a user adds 5 items to wishlist while the network is failing, the UI shows all 5 hearts filled. On next page load, `loadWishlist` fetches from server and overwrites local state — all 5 disappear. The user has no idea.

**Fix:**
1. Track failed sync operations in a queue (in-memory or sessionStorage)
2. Retry failed operations when the user takes any subsequent wishlist action
3. Show a small toast/banner if a sync fails: "Wishlist not synced — try again"
4. On `loadWishlist`, merge server state with any pending local changes instead of replacing

---

### MEDIUM #1 — Webhook signature verification has no logging context

**File:** `api/src/routes/webhooks.js:47-50`

If signature verification fails, the error log is `[WEBHOOK] Signature verification failed: <reason>` with no event ID, source IP, headers, or body length. In a real attack scenario (someone trying to forge webhooks), there's no way to investigate.

**Fix:** include `req.ip`, the `stripe-signature` header value (truncated), and a body hash in the log line. Add a counter so you can alert on repeated failures from the same IP.

---

### MEDIUM #2 — Global error handler logs to console only

**File:** `api/src/middleware/errorHandler.js`

The handler returns a clean structured response to clients (good) but only logs to console. The doc comment says "Sentry will capture this in production" — Sentry is NOT actually integrated. There is no external error reporting, no alerting on 500s, and no aggregation.

**Fix options (pick one):**
- **Sentry** — easy to wire up, generous free tier, gives stack traces and request context out of the box
- **AWS CloudWatch Logs Insights** — already in the stack, just need structured JSON logging and an alert metric filter
- **Custom** — write to a `error_log` DB table and have an admin page

Recommended: structured JSON logging to stdout (App Runner already collects to CloudWatch), plus a CloudWatch metric filter that alerts on 5xx errors above a threshold.

---

### MEDIUM #3 — Stripe SDK has no timeout configuration

**Files:** `api/src/routes/admin.js`, `api/src/routes/checkout.js`, `api/src/routes/webhooks.js`

Stripe SDK calls (`stripe.refunds.create`, `stripe.paymentIntents.create`, `stripe.webhooks.constructEvent`) use the default 80-second timeout. If Stripe is slow or hung, the request hangs for 80 seconds, holding a DB connection and an Express handler. Under load, you can run out of both.

**Fix:** initialize Stripe with `{ timeout: 10000 }` (10 seconds is plenty; Stripe is normally <1 sec):
```js
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, {
  timeout: 10000,
  maxNetworkRetries: 2,
});
```

---

### MEDIUM #4 — Database connection failure has no retry / circuit breaker

**Inferred from:** Prisma client setup in `api/src/lib/prisma.js`

If Postgres is briefly unavailable (RDS failover, network blip), every in-flight request fails immediately and clients see 500. There's no retry, no circuit breaker, no graceful degradation.

**Fix:** wrap critical Prisma calls in a retry helper for transient errors (P1001 connection errors). Don't retry on logic errors (P2025 not found, P2002 unique violation, etc.).

---

### MEDIUM #5 — No request ID for tracing

**File:** all API routes

When a customer reports "my checkout failed", there is no way to find their specific request in the logs. Logs have method + path + error message, but no per-request correlation ID.

**Fix:** add a middleware that assigns a UUID to each request, attaches it to `req.id`, includes it in every log line, and returns it as an `X-Request-Id` header so customers can quote it back.

---

## Section 2 — Quality Issues That Aren't Strictly Errors

### Q1 — No integration tests for the line-item editing endpoint

**File:** `api/src/routes/admin.js` (PUT /orders/:id/items, v5.3.7)

The most complex endpoint in the codebase has zero automated tests. It has full Prisma transaction logic, restock-on-removal, stock validation, and audit trail — all the stuff that's most likely to break under edge cases. It was validated by parse + structural QA + schema audit, but never run against real data.

**Recommendation:** add a Jest/Vitest test suite that uses a test database (or Prisma's mocked client) to verify:
- Full removal restocks correctly
- Quantity increase decrements stock by delta only
- Insufficient stock returns 409 with the right error code
- Tax/shipping/discount are NOT touched
- Audit note appends correctly
- Transaction rolls back on partial failure

### Q2 — Same applies to the refund endpoint (v5.3.8)

`POST /api/admin/orders/:id/refund` — full vs partial refund logic, restocking-on-full, Stripe API integration. Zero tests.

### Q3 — Frontend has no tests at all

Component tests, integration tests, e2e tests — none exist. The admin pages, the checkout flow, the wishlist context — all manually tested only.

### Q4 — Mailchimp / SES / Stripe are real external dependencies with no mock for local dev

If you're working offline or your API keys are stale, all of these blow up. Suggest a `MOCK_EXTERNAL_SERVICES=true` env var that stubs them with predictable responses for local dev.

---

## Section 3 — Feature Gap Tracker (master list)

This is the authoritative list of everything outstanding. Items marked ✅ are done as of v5.3.8.

### Built and shipped (by version)

| Version | Item | Status |
|---|---|---|
| v5.3.4 | US Medical Liberty Map (50 states, ICAN bolded, hover fix) | ✅ |
| v5.3.4 | Quick Add for all products on all devices | ✅ |
| v5.3.5 | Admin frontend auth gate (security fix — was unprotected) | ✅ |
| v5.3.5 | Password reset end-to-end (schema, endpoints, email, frontend) | ✅ |
| v5.3.5 | Doc accuracy audit (corrected false BUILT claims in workflow spec) | ✅ |
| v5.3.6 | Admin Dashboard with stats + top sellers + low stock alerts | ✅ |
| v5.3.6 | Admin Inventory page (flattened variant view, search/filter) | ✅ |
| v5.3.6 | Admin Promos CRUD UI + DELETE endpoint with usage protection | ✅ |
| v5.3.6 | Admin Customers list + customer profile drill-down | ✅ |
| v5.3.6 | Sidebar admin layout matching v5.3.3 stakeholder mock | ✅ |
| v5.3.7 | Order line-item editing (transaction-safe restock + recalc + audit) | ✅ |
| v5.3.7 | Product status `coming_soon` and `prelaunch` (no migration) | ✅ |
| v5.3.7 | Stripe webhook auto-transition pending → processing | ✅ |
| v5.3.8 | Stripe refund button (full + partial with restocking logic) | ✅ |
| v5.3.8 | Per-order ops fulfillment email with packing slip | ✅ |
| v5.3.8 | Stripe Tax flag (requires dashboard activation to take effect) | ✅ |
| v5.3.9 | Webhook atomicity — Prisma `$transaction` with `SELECT FOR UPDATE` row locks | ✅ |
| v5.3.9 | FailedWebhook dead-letter queue (schema + migration + DLQ write on error) | ✅ |
| v5.3.9 | Admin DLQ recovery UI (/admin/failed-webhooks — list, retry, resolve) | ✅ |
| v5.3.9 | Admin alert email on webhook failure (SES, styled, CTA to DLQ page) | ✅ |
| v5.3.9 | Enhanced webhook signature failure logging (IP, sig prefix, body length) | ✅ |
| v5.4.0 | Shippo end-to-end: service, schema, endpoints, frontend, tracking webhook | ✅ |
| v5.4.0 | Consumer fix: orders linked to user accounts (userId on checkout) | ✅ |
| v5.4.0 | Consumer fix: prelaunch products purchasable at checkout | ✅ |
| v5.4.0 | Consumer fix: promo code input at checkout (full validation + discount) | ✅ |
| v5.4.0 | Consumer fix: confirmation page shows order number + account link | ✅ |
| v5.4.1 | Welcome email after registration | ✅ |
| v5.4.1 | Shipping notification email to customer (Shippo label + manual status) | ✅ |
| v5.4.1 | Delivery confirmation email (Shippo DELIVERED webhook) | ✅ |
| v5.4.2 | Newsletter API stops lying on failure (returns 502 + subscribed:false) | ✅ |
| v5.4.2 | NewsletterSection + PromoPopup check res.ok, show errors, allow retry | ✅ |
| v5.4.2 | Stripe SDK centralized with 10s timeout + 2 retries (was 80s/0) | ✅ |
| v5.4.6 | Cloudflare Turnstile fully wired (middleware mounted + widget on register/login) | ✅ |
| v5.4.6 | Doc accuracy: 9.5 low-stock alert wording, 10.3 Lambda template clarified, 13.5 Turnstile expanded | ✅ |
| v5.4.6 | End-to-end regression: 60/60 PASS across 8 user-journey categories | ✅ |
| v5.4.3 | Wishlist sync retry queue (sessionStorage, flush on action/load/30s timer) | ✅ |

### Built but NOT yet delivered

| Item | Reason |
|---|---|
| (none — all builds through v5.3.9 delivered) | |

### Known technical risks (tracked for ongoing monitoring)

| Risk | File | Severity | Mitigation |
|---|---|---|---|
| **Prisma `$queryRaw` for row locks** | `api/src/routes/webhooks.js` | MED | Uses raw SQL (`SELECT ... FOR UPDATE`) because Prisma doesn't expose row-level locking through its query builder. Column names are hardcoded to the physical DB names (`orders.status`, `variants.stock_qty`) rather than Prisma model field names. If a future migration renames these columns via `@map()`, the raw SQL silently breaks at runtime — Prisma's type checking won't catch it. Verified by automated column audit (2/2 pass). Full risk analysis in `CHANGELOG_v5.3.9.md` "Known risks" section. **Smoke-testable:** place a test order after deploy — if it goes to `processing` with correct stock decrement, the SQL works. |
| **No integration test for transaction logic** | `api/src/routes/webhooks.js` | MED | The most complex transactional code in the codebase has zero automated tests. Static analysis, schema audit, and column audit give high confidence but can't catch runtime edge cases (Postgres version quirks, deadlock under extreme concurrency). Should be the first test written when a test suite is established. |
| **No integration test for refund flow** | `api/src/routes/admin.js` | MED | The Stripe refund endpoint + restocking logic has no automated tests. Validated by parse + structural QA + schema audit only. |

### Not yet built — features

| Priority | Item | Notes |
|---|---|---|
| ~~HIGH~~ | ~~**Shippo end-to-end integration**~~ | ✅ DONE in v5.4.0. See CHANGELOG_v5.4.0.md. |
| ~~HIGH~~ | ~~**Welcome email after registration**~~ | ✅ DONE in v5.4.1. Fires after registration in auth.js. |
| ~~HIGH~~ | ~~**Shipping notification email**~~ | ✅ DONE in v5.4.1. Fires from both Shippo label purchase and manual status change to shipped. |
| ~~MED~~ | ~~**Delivery confirmation email**~~ | ✅ DONE in v5.4.1. Fires from Shippo DELIVERED webhook. |
| MED | **Review request email** | Sent N days post-delivery. Optional, marketing nice-to-have. |
| MED | **Customer link drill-through on order detail** | Order page shows email as plain text — should link to `/admin/customers/[id]`. Small touch. |
| MED | **Inline inventory editing on /admin/inventory** | Currently inventory page is read + drill-through only. Real stock edits happen on product detail. Would need a new bulk-update endpoint. |
| LOW | **Weekly inventory digest email** | Cron + Lambda + EventBridge + email template (workflow spec 9.4). |
| LOW | **Admin analytics deeper dashboard** | Revenue charts over time, conversion funnel, customer cohorts, geographic heatmap. The basic v5.3.6 dashboard covers the essentials. |

### Not yet built — quality and correctness (tracked from audit)

| Priority | Item | From audit section | Status |
|---|---|---|---|
| ~~CRITICAL~~ | ~~Wrap webhook inventory deduction in Prisma transaction with row lock~~ | ~~CRITICAL #1~~ | ✅ v5.3.9 |
| ~~CRITICAL~~ | ~~Failed webhook dead-letter queue + admin recovery UI + alert~~ | ~~CRITICAL #2~~ | ✅ v5.3.9 |
| ~~HIGH~~ | ~~Newsletter signup failure queue + retry (don't lie to user)~~ | ~~HIGH #1~~ | ✅ v5.4.2 |
| ~~HIGH~~ | ~~PromoPopup error display + retry on failed signup~~ | ~~HIGH #2~~ | ✅ v5.4.2 |
| ~~HIGH~~ | ~~Wishlist sync failure tracking + retry queue~~ | ~~HIGH #3~~ | ✅ v5.4.3 |
| ~~MED~~ | ~~Webhook signature verification logging (IP, headers)~~ | ~~MED #1~~ | ✅ v5.3.9 |
| ~~MED~~ | ~~External error reporting (structured JSON logging for CloudWatch)~~ | ~~MED #2~~ | ✅ v5.4.4 |
| ~~MED~~ | ~~Stripe SDK timeout + retry config~~ | ~~MED #3~~ | ✅ v5.4.2 |
| ~~MED~~ | ~~Database transient error retry helper~~ | ~~MED #4~~ | ✅ v5.4.4 |
| ~~MED~~ | ~~Request ID middleware + X-Request-Id header~~ | ~~MED #5~~ | ✅ v5.4.4 |

### Not yet built — testing

| Priority | Item |
|---|---|
| ~~HIGH~~ | ~~Integration tests for line-item editing~~ ✅ v5.4.5 |
| ~~HIGH~~ | ~~Integration tests for refund flow~~ ✅ v5.4.5 |
| ~~MED~~ | ~~Component tests for admin pages (Dashboard, Inventory, Promos, Customers)~~ ✅ v5.5.0 |
| ~~MED~~ | ~~E2E test for the checkout → payment → confirmation flow~~ ✅ v5.4.9 |
| ~~LOW~~ | ~~Mock external services (Stripe/SES/Mailchimp) for local dev~~ ✅ v5.4.8 |

### Pre-launch operational gaps

**See `PRE_LAUNCH_CHECKLIST.md` for the canonical list of operator setup
tasks** (SES production access, first admin user creation, Stripe + Shippo
+ Turnstile + cron configuration, env vars, final smoke test). That document
is the single source of truth for everything an operator must do between
"code complete" and "ready for real customers." None of those items
require code changes — they're third-party config and one-time bootstrap.

---

## Section 4 — Recommended next session priorities

All sessions complete. The codebase is feature-complete and the gap tracker
is closed:

1. ~~Deliver v5.3.9~~ ✅ Delivered
2. ~~Critical fixes (v5.3.9)~~ ✅ DONE
3. ~~Shippo integration (v5.4.0)~~ ✅ DONE — last original feature
4. ~~Email stack (v5.4.1)~~ ✅ DONE — welcome, shipping notification, delivery confirmation
5. ~~Honesty fixes (v5.4.2)~~ ✅ DONE — newsletter, PromoPopup, Stripe SDK
6. ~~Wishlist sync retry (v5.4.3)~~ ✅ DONE — sessionStorage queue, periodic flush
7. ~~Observability (v5.4.4)~~ ✅ DONE — request ID middleware + structured JSON logs + DB retry
8. ~~Integration tests (v5.4.5)~~ ✅ DONE — webhook tx (7), refund (6), line-items (5)
9. ~~End-to-end regression + Turnstile wiring (v5.4.6)~~ ✅ DONE — 60/60 pass, one real bug found and fixed
10. ~~Documentation handover (v5.4.7)~~ ✅ DONE — PRE_LAUNCH_CHECKLIST.md, doc map, final accuracy pass

**The site is feature-complete and ready for the operator's pre-launch
runbook (`PRE_LAUNCH_CHECKLIST.md`).**

---

## v5.5.2 — v5.6.0

11. ~~Deployment runbooks (v5.5.2)~~ ✅ DONE — PATH_1 (AWS), PATH_2 (Vercel/Railway), CHOOSE doc
12. ~~Critical bugfixes (v5.5.3)~~ ✅ DONE — JWT field mismatch in checkout, shared/constants missing
13. ~~Doc accuracy (v5.5.4)~~ ✅ DONE — Shippo env var name corrections
14. ~~Email promo display (v5.5.5)~~ ✅ DONE — conditional discount row in order + fulfillment emails
15. ~~Senior code review (v5.6.0)~~ ✅ DONE — 15 improvements: inStock fix, checkout parallelization, loginLimiter split, CORS www + Amplify, next/image, branded 404/error pages, email CTAs, promo JWT extraction, apprunner.yaml 15-secret mapping

**All gaps closed. The site is launch-ready at v5.6.1.**
