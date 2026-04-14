/**
 * Admin Authentication Middleware
 *
 * [AV-016] feat: user accounts with NextAuth.js
 * [AV-040] feat: CRON_TOKEN path for Lambda → API authentication
 *
 * Three authentication paths:
 * 1. JWT token: Bearer token is a signed JWT from /api/auth/login.
 *    The JWT is verified using NEXTAUTH_SECRET, then the decoded
 *    userId is used to look up the user and confirm admin role.
 *    The x-user-id header is NEVER trusted — only the signed JWT.
 *
 * 2. CRON_TOKEN: If CRON_TOKEN env var is set and the Bearer token
 *    matches it, access is granted. Used by EventBridge → Lambda →
 *    cron endpoints. Generate with: openssl rand -base64 32
 *    Store in AWS Secrets Manager. Different from ADMIN_TOKEN so
 *    you can rotate them independently.
 *
 * 3. Legacy ADMIN_TOKEN fallback: If ADMIN_TOKEN env var is set and
 *    the Bearer token matches it, access is granted. Remove from
 *    production .env once all admin users have accounts.
 */

const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');
const { JWT_SECRET } = require('../lib/jwt');

const adminAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: {
        code: 'UNAUTHORIZED',
        message: 'Admin authentication required.',
      },
    });
  }

  const token = authHeader.split(' ')[1];

  // Path 1: CRON_TOKEN for scheduled Lambda invocations
  // Checked first because cron requests are highest volume on this path
  if (process.env.CRON_TOKEN && token === process.env.CRON_TOKEN) {
    req.adminUser = { id: 'cron', role: 'cron' };
    return next();
  }

  // Path 2: Legacy ADMIN_TOKEN fallback
  if (process.env.ADMIN_TOKEN && token === process.env.ADMIN_TOKEN) {
    return next();
  }

  // Path 3: Verify JWT and check admin role
  try {
    // Verify the JWT signature — rejects tampered or expired tokens
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded.userId) {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Invalid token.' },
      });
    }

    // Verify the user still exists and still has admin role
    // (handles: user deleted, role downgraded since token was issued)
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, role: true },
    });

    if (!user || user.role !== 'admin') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Admin access required.' },
      });
    }

    req.adminUser = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(403).json({
        error: { code: 'FORBIDDEN', message: 'Invalid or expired token.' },
      });
    }
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Authentication error.' },
    });
  }
};

module.exports = { adminAuth };
