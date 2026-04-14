#!/usr/bin/env node
/**
 * Pre-deploy Migration Runner — ANTIVAXXER
 *
 * [AV-042] feat: AWS deployment migration runner
 *
 * Runs Prisma migrations before the API deploys. Used in:
 *   - App Runner build phase (apprunner.yaml)
 *   - Dockerfile build (optional, can also run at runtime)
 *   - GitHub Actions PR validation
 *   - Manual: `node scripts/run-migrations.js` (loads root `.env` + `api/.env` via `loadEnv.js`)
 *
 * Behavior:
 *   - Runs `prisma migrate deploy` (forward-only, idempotent)
 *   - On success: exits 0, deployment continues
 *   - On failure: exits 1, deployment is aborted by App Runner
 *   - Database stays at the previous schema version
 *   - Previous API version keeps running (no downtime)
 *
 * Why a separate script instead of just running prisma migrate deploy?
 *   - Captures and logs detailed error info
 *   - Verifies DATABASE_URL exists before attempting connection
 *   - Provides clear exit codes for CI/CD
 *   - Can be extended with pre-migration backups, schema validation, etc.
 */

require('../loadEnv');

const { execSync } = require('child_process');

// --- Pre-flight checks ---
if (!process.env.DATABASE_URL) {
  console.error('[MIGRATE] FATAL: DATABASE_URL is not set.');
  console.error('[MIGRATE] Cannot run migrations without a database connection.');
  process.exit(1);
}

console.log('[MIGRATE] Starting database migration...');
console.log('[MIGRATE] Target: ' + process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@'));

// --- Run migrations ---
try {
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    cwd: __dirname + '/..',
  });
  console.log('[MIGRATE] ✓ Migrations applied successfully.');
  process.exit(0);
} catch (error) {
  console.error('[MIGRATE] ✗ Migration failed:', error.message);
  console.error('[MIGRATE] Deployment will be aborted.');
  console.error('[MIGRATE] Previous API version remains running.');
  console.error('[MIGRATE] To recover:');
  console.error('[MIGRATE]   1. Check the migration error above');
  console.error('[MIGRATE]   2. Review the migration file in api/prisma/migrations/');
  console.error('[MIGRATE]   3. Test the fix against a staging database');
  console.error('[MIGRATE]   4. Push the fix to trigger a new deploy');
  process.exit(1);
}
