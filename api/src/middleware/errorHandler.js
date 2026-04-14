/**
 * Global Error Handler Middleware
 *
 * Per Error Handling Standards (Playbook Section 12):
 * - Structured error responses: { error: { code, message } }
 * - Never expose stack traces, DB column names, or internal paths to client
 * - Log full error details server-side for debugging
 */

const errorHandler = (err, req, res, _next) => {
  // Log full error server-side (Sentry will capture this in production)
  console.error(`[ERROR] ${req.method} ${req.path}:`, {
    message: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    code: err.code,
  });

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Structured response — never expose internals
  res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message:
        statusCode === 500
          ? 'An unexpected error occurred. Please try again.'
          : err.message || 'Something went wrong.',
    },
  });
};

module.exports = { errorHandler };
