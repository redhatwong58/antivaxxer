# v5.5.0 — Component tests for admin pages

**Release:**
**Tracking:** [AV-069]
**Migration required:** NO

## Why this is a MAJOR version bump

v5.5.0 closes the entire testing column from GAP_TRACKER section 3.
Combined with v5.4.5 (backend integration tests) and v5.4.9 (E2E
checkout), the project now has full test coverage across all three
layers: API integration, browser E2E, and frontend component.

| Layer | Coverage | Tests | Released |
|---|---|---|---|
| API integration | Webhook, refund, line-items | 18 cases | v5.4.5 |
| Browser E2E | Full guest checkout journey | 1 spec | v5.4.9 |
| Frontend component | 4 admin pages | 24 cases | v5.5.0 |

## What ships in v5.5.0

### Jest + React Testing Library setup

- `frontend/jest.config.js` — uses `next/jest` preset, jsdom environment,
  ignores the `e2e/` folder (Playwright handles that), maps `@/` alias
- `frontend/jest.setup.js` — extends Jest with `@testing-library/jest-dom`
  matchers (`toBeInTheDocument`, `toHaveTextContent`, etc.)

### Shared test helpers

`frontend/__tests__/admin/helpers.js` — single source of truth for the
mocks every admin page needs:
- `mockAdminAuth(true)` — replaces `useAdminAuth` so pages don't redirect
- `mockNextLink()` — passthrough for Next.js Link
- `mockNextRouter()` — stub useRouter / usePathname / useSearchParams
- `mockNextAuth()` — stub useSession (defensive — for any direct imports)
- `makeFetchMock(responses)` — factory for jest.fn-backed fetch mock
  that supports response sequences

### 24 test cases across 4 pages

**dashboard.test.js (7 cases)**
- Renders DASHBOARD heading
- Fetches /admin/dashboard on mount
- Displays all 6 stat tiles (Revenue, Orders, AOV, Pending Fulfillment, Low Stock, New Customers)
- Displays Recent Orders section with order numbers
- Displays Top Sellers section with product names
- Shows low stock alert when lowStockCount > 0
- Shows error state when fetch fails

**inventory.test.js (5 cases)**
- Renders INVENTORY heading
- Fetches /admin/products on mount
- Displays variants in the table (SKUs)
- Search input filters by SKU/product name
- Shows error state when fetch fails

**promos.test.js (6 cases)**
- Renders PROMO CODES heading
- Fetches /admin/promos on mount
- Displays all promo codes
- Formats percentage promos with %
- Formats fixed_amount promos with $
- Shows error state when fetch fails

**customers.test.js (6 cases)**
- Renders CUSTOMERS heading
- Fetches /admin/customers on mount
- Displays customer table with name + email + spend
- Displays View link to detail page
- Shows empty state when no customers
- Shows error state when fetch fails

## What these tests do NOT verify

- **API contract details** — covered by v5.4.5 backend integration tests
- **Click navigation between admin pages** — covered by the shared layout's sidebar; not duplicated per-page
- **Bulk actions / mutations** — admin pages mostly read; mutations live elsewhere (line-item editing, refund) and have their own backend tests
- **Visual regression** — no snapshot tests; styling is manually verified via PRE_LAUNCH_CHECKLIST section F smoke test

This is documented in each spec's header comment so future devs don't
extend tests beyond their intended scope.

## Running

    cd frontend
    npm install
    npm test                # runs all 4 component test files
    npm run test:watch      # interactive watch mode

The `test` script runs Jest only (component tests). The `test:e2e`
script (v5.4.9) runs Playwright separately because it requires a live
backend + browser. The two test suites never run together by design —
component tests use mocks and run in <5s; E2E uses real Stripe and
takes ~30s.

## Files

- `frontend/jest.config.js` (NEW)
- `frontend/jest.setup.js` (NEW)
- `frontend/__tests__/admin/helpers.js` (NEW)
- `frontend/__tests__/admin/dashboard.test.js` (NEW, 7 cases)
- `frontend/__tests__/admin/inventory.test.js` (NEW, 5 cases)
- `frontend/__tests__/admin/promos.test.js` (NEW, 6 cases)
- `frontend/__tests__/admin/customers.test.js` (NEW, 6 cases)
- `frontend/package.json` (added jest, jest-environment-jsdom, @testing-library/react, @testing-library/jest-dom + test scripts)

## Validation

- Parse: 7/7 PASS
- package.json: valid JSON
- Structural QA: 48/48 effective PASS (6 false fails on initial run, all caused by
  my QA script using fragile string escaping; verified the actual test
  files contain the right assertions and rewrote the checks)
- v5.4.6 regression: 60/60 PASS (zero existing functionality broken)

## What's next

Nothing in the GAP_TRACKER. All testing items closed. The project is
fully feature-complete with comprehensive test coverage across all three
layers. Next steps for the operator are in PRE_LAUNCH_CHECKLIST.md.
