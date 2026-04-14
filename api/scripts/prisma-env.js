#!/usr/bin/env node
/**
 * Run Prisma CLI with the same env files as the API (root .env + api/.env).
 * Use npm scripts (e.g. db:migrate:dev) instead of raw `npx prisma` so DATABASE_URL is loaded.
 */
require('../loadEnv');

const path = require('path');
const { spawnSync } = require('child_process');

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error('Usage: node scripts/prisma-env.js <prisma subcommand> [...args]');
  process.exit(1);
}

const apiRoot = path.join(__dirname, '..');
const result = spawnSync('npx', ['prisma', ...args], {
  cwd: apiRoot,
  stdio: 'inherit',
  env: process.env,
  shell: true,
});

process.exit(result.status === null ? 1 : result.status);
