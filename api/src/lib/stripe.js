/**
 * Centralized Stripe SDK — ANTIVAXXER
 *
 * [AV-061] v5.4.2 — single initialization point for the Stripe SDK.
 * All route files import from here instead of calling require('stripe')
 * directly. This ensures consistent timeout and retry config everywhere.
 *
 * Previously: default 80-second timeout, no retries. A hung Stripe call
 * would hold an Express handler + DB connection for 80 seconds.
 *
 * Now: 10-second timeout (Stripe normally responds in <1s), 2 automatic
 * retries on transient network errors. If Stripe is truly down, the
 * request fails fast and the user gets a clear error instead of a
 * browser timeout.
 *
 * [AV-067] v5.4.8 — optional STRIPE_API_BASE env var routes to a local
 * stripe-mock instance for offline dev. When unset (production), the SDK
 * hits api.stripe.com as normal. Same Stripe API in both cases — only
 * the host changes.
 */

const config = {
  timeout: 10000,        // 10 seconds (was 80s default)
  maxNetworkRetries: 2,  // retry transient failures twice
};

if (process.env.STRIPE_API_BASE) {
  // Parse host + port + protocol from STRIPE_API_BASE (e.g. http://localhost:12111)
  const url = new URL(process.env.STRIPE_API_BASE);
  config.host = url.hostname;
  config.port = url.port ? Number(url.port) : undefined;
  config.protocol = url.protocol.replace(':', '');
  console.log(`[STRIPE] Using local mock at ${process.env.STRIPE_API_BASE}`);
}

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY, config);

module.exports = stripe;
