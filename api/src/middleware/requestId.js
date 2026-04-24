/**
 * Request ID Middleware — ANTIVAXXER
 *
 * [AV-063] v5.4.4 — assigns a unique ID to every request for end-to-end
 * tracing. The ID is:
 *   1. Attached to `req.id` for use in log statements throughout the handler
 *   2. Returned as `X-Request-Id` response header so the client/customer
 *      can quote it in support requests
 *   3. Included in the global error handler's log output
 *
 * If the client sends an `X-Request-Id` header (e.g. from a load balancer
 * or frontend retry), that value is reused. Otherwise a new UUID is generated.
 */

const { randomUUID } = require('crypto');

function requestId(req, res, next) {
  req.id = req.headers['x-request-id'] || randomUUID();
  res.setHeader('X-Request-Id', req.id);
  next();
}

module.exports = { requestId };
