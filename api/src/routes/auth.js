/**
 * Auth Routes — User Registration
 *
 * [AV-016] feat: user accounts with NextAuth.js
 *
 * POST /api/auth/register — Create new user account
 *
 * Login is handled by NextAuth on the frontend side.
 * This endpoint only handles registration (password hashing).
 */

const express = require('express');
const router = express.Router();
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');
const { JWT_SECRET, JWT_EXPIRES } = require('../lib/jwt');
const { validate } = require('../middleware/validate');
const { loginLimiter, registerLimiter } = require('../middleware/rateLimiter');
const { turnstileVerify } = require('../middleware/turnstile');
const { sendPasswordResetEmail } = require('../services/email');
const { z } = require('zod');

// Generate a signed API token for a user
function generateApiToken(user) {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRES }
  );
}

const registerBody = z.object({
  name: z.string().min(1, 'Name is required').max(100),
  email: z.string().email('Valid email is required').max(255),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
});

const loginBody = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ===== POST /api/auth/login =====
// Verifies credentials, returns user data. Called by NextAuth CredentialsProvider.
// [WS-13] loginLimiter: 10 req / 15 min (was sharing registerLimiter at 5 req / 1 hr)
router.post('/login', loginLimiter, turnstileVerify, validate(loginBody, 'body'), async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({
        error: { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password.' },
      });
    }

    res.json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      apiToken: generateApiToken(user),
    });
  } catch (error) {
    next(error);
  }
});

// ===== POST /api/auth/register =====
router.post('/register', registerLimiter, turnstileVerify, validate(registerBody, 'body'), async (req, res, next) => {
  try {
    const { name, email, password } = req.body;

    // Check if email already exists
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (existing) {
      return res.status(409).json({
        error: {
          code: 'EMAIL_EXISTS',
          message: 'An account with this email already exists.',
        },
      });
    }

    // Hash password (bcrypt cost factor 12)
    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: 'customer',
      },
    });

    res.status(201).json({
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
      apiToken: generateApiToken(user),
    });

    // [AV-060] v5.4.1 — fire-and-forget welcome email. Runs AFTER the
    // response is sent so the user isn't waiting on SES.
    try {
      const { sendWelcomeEmail } = require('../services/email');
      await sendWelcomeEmail({ email: user.email, name: user.name });
    } catch (emailErr) {
      console.error('[AUTH] Welcome email failed (non-fatal):', emailErr.message);
    }
  } catch (error) {
    next(error);
  }
});

const forgotBody = z.object({
  email: z.string().email().max(255),
});

const resetBody = z.object({
  token: z.string().min(20).max(200),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .max(128),
});

// ===== POST /api/auth/forgot-password =====
// [AV-049] v5.3.5
// Generates a 32-byte random token, stores SHA-256(token) on the user row
// with a 1-hour expiry, emails the raw token to the user.
//
// SECURITY NOTES:
// - Always returns 200 with the same generic message — never reveals
//   whether the email is registered (prevents account enumeration).
// - Raw token is only ever in the email/URL — only the hash is in the DB.
// - Token expiry is enforced in /reset-password.
// - Re-requesting reset for a user with an existing unexpired token
//   overwrites the token (effectively invalidates the previous email).
router.post('/forgot-password', registerLimiter, validate(forgotBody, 'body'), async (req, res, next) => {
  const genericResponse = {
    message: 'If an account exists for that email, a reset link has been sent.',
  };

  try {
    const email = req.body.email.toLowerCase();
    const user = await prisma.user.findUnique({ where: { email } });

    // Always return success — don't leak account existence
    if (!user) {
      console.log(`[AUTH] Forgot password requested for unknown email: ${email}`);
      return res.json(genericResponse);
    }

    // Generate raw token (32 bytes → 64 hex chars), store SHA-256 hash
    const rawToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await prisma.user.update({
      where: { id: user.id },
      data: {
        resetTokenHash: tokenHash,
        resetTokenExpiresAt: expiresAt,
      },
    });

    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const resetUrl = `${siteUrl}/account/reset-password/${rawToken}`;

    try {
      await sendPasswordResetEmail({
        email: user.email,
        name: user.name,
        resetUrl,
      });
    } catch (emailErr) {
      // Log but still return success — user shouldn't see the email failure
      console.error('[AUTH] Failed to send reset email:', emailErr.message);
    }

    return res.json(genericResponse);
  } catch (error) {
    next(error);
  }
});

// ===== POST /api/auth/reset-password =====
// [AV-049] v5.3.5
// Verifies the token (by hashing the submitted raw token and looking up
// the matching user), checks expiry, hashes the new password, clears the
// reset token fields. Constant-time-ish: token lookup is by indexed hash.
router.post('/reset-password', validate(resetBody, 'body'), async (req, res, next) => {
  try {
    const { token, password } = req.body;
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const user = await prisma.user.findFirst({
      where: { resetTokenHash: tokenHash },
    });

    if (!user) {
      return res.status(400).json({
        error: { code: 'INVALID_TOKEN', message: 'This reset link is invalid or has already been used.' },
      });
    }

    if (!user.resetTokenExpiresAt || user.resetTokenExpiresAt < new Date()) {
      // Clear the expired token so it can't be retried
      await prisma.user.update({
        where: { id: user.id },
        data: { resetTokenHash: null, resetTokenExpiresAt: null },
      });
      return res.status(400).json({
        error: { code: 'EXPIRED_TOKEN', message: 'This reset link has expired. Please request a new one.' },
      });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      },
    });

    console.log(`[AUTH] Password reset completed for ${user.email}`);

    return res.json({
      message: 'Password updated. You can now sign in with your new password.',
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
