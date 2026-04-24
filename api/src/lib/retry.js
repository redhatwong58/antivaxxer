/**
 * Prisma Retry Helper — ANTIVAXXER
 *
 * [AV-063] v5.4.4 — retries Prisma operations on transient database errors.
 *
 * Transient errors (worth retrying):
 *   P1001 — Can't reach database server (RDS failover, network blip)
 *   P1002 — Database server reached but timed out
 *   P1008 — Operations timed out
 *   P1017 — Server has closed the connection
 *   P2034 — Transaction failed due to write conflict or deadlock
 *
 * Non-transient errors (NOT retried — would fail the same way):
 *   P2002 — Unique constraint violation
 *   P2025 — Record not found
 *   P2003 — Foreign key constraint violation
 *   Everything else
 *
 * Usage:
 *   const { withRetry } = require('../lib/retry');
 *
 *   // Wrap any Prisma call:
 *   const user = await withRetry(() => prisma.user.findUnique({ where: { id } }));
 *
 *   // Custom options:
 *   const result = await withRetry(
 *     () => prisma.order.update({ ... }),
 *     { maxRetries: 5, baseDelayMs: 200 }
 *   );
 *
 * This is NOT needed for every Prisma call — only for critical paths where
 * a transient failure would cause a bad user experience (e.g. checkout,
 * webhook processing). Most admin CRUD endpoints can just let the error
 * propagate to the global handler.
 */

const TRANSIENT_CODES = new Set([
  'P1001', // Can't reach database server
  'P1002', // Database server timed out
  'P1008', // Operations timed out
  'P1017', // Server closed connection
  'P2034', // Transaction conflict / deadlock
]);

/**
 * @param {Function} fn — async function that calls Prisma
 * @param {Object} [opts]
 * @param {number} [opts.maxRetries=3] — max retry attempts
 * @param {number} [opts.baseDelayMs=100] — base delay (doubles each retry)
 * @returns {Promise<*>} — result of fn()
 */
async function withRetry(fn, opts = {}) {
  const maxRetries = opts.maxRetries ?? 3;
  const baseDelayMs = opts.baseDelayMs ?? 100;

  let lastError;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      const isTransient = TRANSIENT_CODES.has(err.code);

      if (!isTransient || attempt === maxRetries) {
        throw err; // non-transient or exhausted retries — let it propagate
      }

      // Exponential backoff with jitter
      const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 50;
      console.warn(
        `[DB RETRY] Transient error ${err.code} on attempt ${attempt + 1}/${maxRetries + 1}. ` +
        `Retrying in ${Math.round(delay)}ms...`
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
  throw lastError;
}

module.exports = { withRetry };
