/**
 * Jest config for frontend component tests
 *
 * [AV-069] v5.5.0 — uses next/jest preset which handles JSX, CSS modules,
 * absolute imports (@/), and SWC compilation automatically.
 *
 * Run: npm run test (from frontend/)
 *
 * Scope: component tests for admin pages. NOT for E2E (use Playwright via
 * `npm run test:e2e`) and NOT for backend (use Jest in api/ via `cd api && npm test`).
 */

const nextJest = require('next/jest');

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testEnvironment: 'jest-environment-jsdom',
  testMatch: ['**/__tests__/**/*.test.js', '**/?(*.)+(spec|test).js'],
  // Skip the e2e folder — those are Playwright tests, run separately
  testPathIgnorePatterns: ['/node_modules/', '/e2e/', '/.next/'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  clearMocks: true,
};

module.exports = createJestConfig(customJestConfig);
