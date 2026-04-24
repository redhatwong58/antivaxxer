/**
 * Global Error Handler Middleware
 *
 * Per Error Handling Standards (Playbook Section 12):
 * - Structured error responses: { error: { code, message, requestId } }
 * - Never expose stack traces, DB column names, or internal paths to client
 * - Log full error details server-side as structured JSON for CloudWatch/Sentry
 *
 * [AV-063] v5.4.4 — includes req.id (from requestId middleware) in both
 * the log output and the client response. Customers can quote the requestId
 * in support requests, and ops can find the exact error in CloudWatch.
 */

const errorHandler = (err, req, res, _next) => {
  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  // Structured JSON log — machine-readable for CloudWatch Insights / Sentry
  const logEntry = {
    level: statusCode >= 500 ? 'error' : 'warn',
    requestId: req.id || 'unknown',
    method: req.method,
    path: req.path,
    statusCode,
    errorCode: err.code || 'INTERNAL_ERROR',
    message: err.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  };
  console.error(JSON.stringify(logEntry));

  // Structured response — never expose internals
  res.status(statusCode).json({
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message:
        statusCode === 500
          ? 'An unexpected error occurred. Please try again.'
          : err.message || 'Something went wrong.',
      requestId: req.id || undefined, // client can quote this in support
    },
  });
};

module.exports = { errorHandler };
