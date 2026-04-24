/**
 * ANTIVAXXER API — Express Server Entry Point
 *
 * [AV-000] chore: project scaffolding
 *
 * Security middleware applied per Dev Operations Playbook:
 * - helmet: security headers (CSP, HSTS, referrer policy)
 * - cors: restricted to frontend origin
 * - rate limiting: per-endpoint limits defined in middleware/
 * - morgan: request logging (no PII)
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const { errorHandler } = require('./middleware/errorHandler');
const { requestId } = require('./middleware/requestId');
const { apiLimiter } = require('./middleware/rateLimiter');

const app = express();
const PORT = process.env.API_PORT || 4000;

// --- Environment Variable Validation ---
// Warn on missing vars at startup (never log secret values)
const ENV_CHECKS = [
  { key: 'DATABASE_URL', required: true, label: 'PostgreSQL connection' },
  { key: 'STRIPE_SECRET_KEY', required: false, label: 'Stripe payments' },
  { key: 'STRIPE_WEBHOOK_SECRET', required: false, label: 'Stripe webhooks' },
  { key: 'NEXTAUTH_SECRET', required: false, label: 'JWT signing (auth)' },
];

ENV_CHECKS.forEach(({ key, required, label }) => {
  if (!process.env[key]) {
    const level = required ? 'ERROR' : 'WARN';
    console[required ? 'error' : 'warn'](
      `[${level}] ${key} not set — ${label} will not work.`
    );
  }
});

// --- Request ID (must be first — all log statements reference req.id) ---
// [AV-063] v5.4.4
app.use(requestId);

// --- Security Headers ---
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", 'https://cdn-cookieyes.com', 'https://js.stripe.com'],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: [
          "'self'",
          'data:',
          `https://${process.env.CLOUDFRONT_DOMAIN || '*.cloudfront.net'}`,
          'https://*.stripe.com',
        ],
        connectSrc: ["'self'", 'https://api.stripe.com', 'https://challenges.cloudflare.com'],
        frameSrc: ["'self'", 'https://js.stripe.com', 'https://challenges.cloudflare.com'],
        frameAncestors: ["'none'"],
      },
    },
    hsts: { maxAge: 31536000, includeSubDomains: true, preload: true },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    permissionsPolicy: {
      features: {
        camera: [],
        microphone: [],
        geolocation: [],
        payment: ['self'],
      },
    },
  })
);

// --- CORS ---
app.use(
  cors({
    origin: function (origin, callback) {
      const allowed = process.env.NEXTAUTH_URL || 'http://localhost:3000';
      // Allow: configured origin, its www variant, no-origin (same-origin / server-to-server),
      // and Amplify preview deployments (*.amplifyapp.com is AWS-owned, HTTPS only)
      if (
        !origin ||
        origin === allowed ||
        origin === allowed.replace('://', '://www.') ||
        (origin.startsWith('https://') && origin.endsWith('.amplifyapp.com'))
      ) {
        callback(null, true);
      } else {
        callback(new Error('CORS: origin not allowed'));
      }
    },
    credentials: true,
  })
);

// --- Webhook routes (MUST be before body parsing — needs raw body for signature) ---
app.use('/api/webhooks', require('./routes/webhooks'));

// --- Body Parsing ---
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// --- Request Logging ---
// [AV-063] v5.4.4 — includes req.id for tracing
morgan.token('request-id', (req) => req.id || '-');
app.use(
  morgan(':request-id :method :url :status :res[content-length] - :response-time ms', {
    skip: (req) => req.url === '/api/health',
  })
);

// --- Rate Limiting (general) ---
app.use('/api/', apiLimiter);

// --- Health Check (no rate limit, no auth) ---
// [AV-041] Enhanced for App Runner — verifies DB connectivity
// Returns 200 if API + DB are both healthy, 503 if DB is unreachable.
// App Runner's health checker pulls unhealthy instances out of rotation.
app.get('/api/health', async (req, res) => {
  const health = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    database: 'unknown',
  };

  try {
    const { prisma } = require('./lib/prisma');
    await prisma.$queryRaw`SELECT 1`;
    health.database = 'connected';
    res.json(health);
  } catch (err) {
    health.status = 'degraded';
    health.database = 'disconnected';
    health.error = 'Database connection failed';
    res.status(503).json(health);
  }
});

// --- Routes ---
// Product routes (public) — Step 4
app.use('/api/products', require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));

// Admin routes (protected) — Steps 6-7
const { adminAuth } = require('./middleware/adminAuth');
const { adminLimiter, checkoutLimiter, registerLimiter } = require('./middleware/rateLimiter');
app.use('/api/admin', adminLimiter, adminAuth, require('./routes/admin'));

// Auth routes — rate limiting + Turnstile applied per-route in auth.js
// [WS-13] login: loginLimiter (10/15min), register: registerLimiter (5/hr),
//         forgot-password: registerLimiter, reset-password: no limit (token is auth)
app.use('/api/auth', require('./routes/auth'));

// Account routes (user must be logged in) — Phase 3
app.use('/api/account', require('./routes/account'));

// Checkout routes (public, rate limited) — Phase 2
app.use('/api/checkout', checkoutLimiter, require('./routes/checkout'));

// Promo routes (public) — Phase 3
app.use('/api/promos', require('./routes/promos'));

// Search routes (public) — Phase 5
app.use('/api/search', require('./routes/search'));

// Cart routes (public — token is the auth) — [AV-034]
app.use('/api/cart', require('./routes/cart'));

// Newsletter routes (public, rate limited) — Phase 5
app.use('/api/newsletter', registerLimiter, require('./routes/newsletter'));

// --- 404 Handler ---
app.use('/api/*', (req, res) => {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Endpoint not found' } });
});

// --- Global Error Handler ---
app.use(errorHandler);

// --- Start Server ---
app.listen(PORT, () => {
  console.log(`[antivaxxer-api] Server running on port ${PORT}`);
  console.log(`[antivaxxer-api] Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;
