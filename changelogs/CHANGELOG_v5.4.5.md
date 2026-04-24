# v5.4.5 — Backend integration tests

**Release:**
**Tracking:** [AV-064]
**Migration required:** NO

> Reconstructed during v5.5.1 handover bundle pass.

## Test suite — 18 cases across 3 files

### webhook.test.js (7 tests) — handlePaymentSuccess
- Happy path: deducts stock, sets status, sends emails
- Idempotency: already-processed order skipped
- Idempotency: status changed mid-transaction (no-op)
- Insufficient stock: throws (transaction rolls back)
- Missing order: returns without error
- Missing variant: throws
- Email failure doesn't break order flow

### refund.test.js (6 tests) — POST /orders/:id/refund
- Full refund: Stripe refund + restock + status=refunded
- Partial refund: no restock, status unchanged
- Already-refunded: rejected 409
- Amount exceeds total: rejected 400
- Missing Stripe PI: rejected 400
- Audit note includes admin email + amount + reason

### lineItems.test.js (5 tests) — PUT /orders/:id/items
- Replace items: old restocked, new created, total recalculated
- Empty items: rejected 400
- Non-editable status (shipped): rejected 409
- Insufficient stock: rejected 409
- Audit note appended

## Files
- `api/__tests__/webhook.test.js` (NEW)
- `api/__tests__/refund.test.js` (NEW)
- `api/__tests__/lineItems.test.js` (NEW)
- `api/jest.config.js` (NEW)
- `api/package.json` (added jest + supertest + test script)

## Setup
    cd api
    npm install
    npm test

## Validation
- Parse: 5/5 PASS
- Structural QA: 31/31 PASS
- Total: 36/36 PASS, 0 FAIL
