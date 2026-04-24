/**
 * Playwright config — ANTIVAXXER E2E tests
 *
 * [AV-068] v5.4.9 — runs full browser tests against a locally running
 * frontend (port 3000) + API (port 4000). Both servers must be started
 * by the operator BEFORE running tests; Playwright doesn't manage them.
 *
 * Usage:
 *   # Terminal 1: docker compose up -d
 *   # Terminal 2: cd api && npm run dev
 *   # Terminal 3: cd frontend && npm run dev
 *   # Terminal 4 (this one):
 *   cd frontend && npm run test:e2e
 *
 * The tests use REAL Stripe test mode for the payment iframe (Stripe.js
 * loads from js.stripe.com and the iframe is owned by Stripe — there's
 * no offline path for the in-browser payment UI). The operator must
 * export STRIPE_TEST_PUBLISHABLE_KEY + STRIPE_TEST_SECRET_KEY before
 * running tests, OR set NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY in their
 * frontend .env to a test-mode key.
 *
 * For offline test runs, use the v5.4.5 backend integration tests
 * (`cd api && npm test`) which mock Stripe entirely.
 */

const { defineConfig, devices } = require('@playwright/test');

module.exports = defineConfig({
  testDir: './e2e',
  fullyParallel: false, // checkout flow has shared cart state in localStorage; serial is safer
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // serial — avoids Stripe rate limit + cart state collisions
  reporter: [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://localhost:3000',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    actionTimeout: 15000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
});
