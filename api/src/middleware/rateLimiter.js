/**
 * Rate Limiting Middleware
 *
 * Per Security Standards (Playbook Section 8):
 * - Auth endpoints: strict (10 login / 15min, 5 register / 1hr)
 * - Checkout: moderate (20 / 15min)
 * - General API: permissive (100 / 15min)
 * - Admin: moderate (60 / 15min)
 *
 * Using MemoryStore for Phase 1 launch.
 * TODO [AV-099]: Migrate to Redis store (ElastiCache) when scaling
 * to multi-instance. MemoryStore resets on server restart.
 */

const rateLimit = require('express-rate-limit');

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests. Please try again later.',
    },
  },
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many login attempts. Please wait 15 minutes.',
    },
  },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many registration attempts. Please try again later.',
    },
  },
});

const checkoutLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many checkout attempts. Please try again shortly.',
    },
  },
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many admin requests. Please slow down.',
    },
  },
});

module.exports = {
  apiLimiter,
  loginLimiter,
  registerLimiter,
  checkoutLimiter,
  adminLimiter,
};
