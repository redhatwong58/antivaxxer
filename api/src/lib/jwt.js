/**
 * JWT Configuration — Shared across auth, admin, and account modules
 *
 * Single source of truth for JWT secret and token settings.
 * Uses NEXTAUTH_SECRET as primary (shared with NextAuth frontend).
 * JWT_SECRET as fallback for standalone API deployments.
 */

const JWT_SECRET = process.env.NEXTAUTH_SECRET || process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES = '7d';

module.exports = { JWT_SECRET, JWT_EXPIRES };
