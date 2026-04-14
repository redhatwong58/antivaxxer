/**
 * Load env for the API package: `api/.env` first, then monorepo root `.env` (overrides).
 * Root `.env` is canonical for DATABASE_URL and shared keys; api/.env can add keys not in root.
 */
const path = require('path');
const dotenv = require('dotenv');

const rootEnv = path.join(__dirname, '../.env');
const apiEnv = path.join(__dirname, '.env');

dotenv.config({ path: apiEnv });
dotenv.config({ path: rootEnv, override: true });
