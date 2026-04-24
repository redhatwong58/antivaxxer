# v5.4.4 — Observability + DB resilience

**Release:**
**Tracking:** [AV-063]
**Migration required:** NO

> Reconstructed during v5.5.1 handover bundle pass.

## Three additions

### 1. Request ID middleware (`api/src/middleware/requestId.js`)
Every request gets a UUID attached to `req.id`. Reuses `X-Request-Id` header if the client sends one (load balancer passthrough). Returns the ID as `X-Request-Id` response header so customers can quote it in support tickets. Mounted first in the middleware chain (before Helmet, CORS, body parsing).

### 2. Structured JSON error logging (`api/src/middleware/errorHandler.js`)
Error handler outputs machine-readable JSON to stdout:
```json
{"level":"error","requestId":"abc-123","method":"POST","path":"/api/checkout","statusCode":500,"errorCode":"INTERNAL_ERROR","message":"..."}
```
CloudWatch Logs Insights can query this directly. Client error response now includes `requestId` so customers can quote it.

### 3. DB transient error retry helper (`api/src/lib/retry.js`)
`withRetry(fn, opts)` wraps any Prisma call with automatic retry on transient errors (P1001, P1002, P1008, P1017, P2034). Exponential backoff with jitter. Non-transient errors (P2002, P2025) are thrown immediately. Available for opt-in use in critical paths.

## Files
- `api/src/middleware/requestId.js` (NEW)
- `api/src/middleware/errorHandler.js` (rewritten)
- `api/src/lib/retry.js` (NEW)
- `api/src/index.js` (requestId import + mount + morgan format)

## Validation
- Parse: 4/4 PASS
- Structural QA: 23/23 PASS
