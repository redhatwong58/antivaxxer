/**
 * Cloudflare Turnstile Verification Middleware
 *
 * [AV-021] feat: cloudflare turnstile bot protection
 *
 * Verifies the Turnstile token from the frontend against
 * Cloudflare's verification API. Graceful degradation:
 * if TURNSTILE_SECRET_KEY is not configured, requests pass through
 * (rate limiting is the fallback protection layer).
 *
 * Usage: Apply to login, register, and checkout routes.
 *   app.use('/api/auth', turnstileVerify, require('./routes/auth'));
 */

async function turnstileVerify(req, res, next) {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  // Graceful degradation: if not configured, skip verification
  if (!secret) {
    return next();
  }

  // Only verify on POST requests (form submissions)
  if (req.method !== 'POST') {
    return next();
  }

  const token = req.body?.turnstileToken || req.headers['x-turnstile-token'];

  if (!token) {
    return res.status(400).json({
      error: {
        code: 'CAPTCHA_REQUIRED',
        message: 'CAPTCHA verification is required.',
      },
    });
  }

  try {
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret,
        response: token,
      }),
    });

    const data = await response.json();

    if (!data.success) {
      return res.status(403).json({
        error: {
          code: 'CAPTCHA_FAILED',
          message: 'CAPTCHA verification failed. Please try again.',
        },
      });
    }

    next();
  } catch (error) {
    // If Turnstile API is down, let the request through
    // Rate limiting is the backup layer
    console.warn('[TURNSTILE] Verification API error:', error.message);
    next();
  }
}

module.exports = { turnstileVerify };
