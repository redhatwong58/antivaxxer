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
const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');
const { JWT_SECRET, JWT_EXPIRES } = require('../lib/jwt');
const { validate } = require('../middleware/validate');
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
router.post('/login', validate(loginBody, 'body'), async (req, res, next) => {
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
router.post('/register', validate(registerBody, 'body'), async (req, res, next) => {
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
  } catch (error) {
    next(error);
  }
});

module.exports = router;
