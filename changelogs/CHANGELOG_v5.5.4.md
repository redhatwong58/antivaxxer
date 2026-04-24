# v5.5.4 — Shippo env var name fix in deployment docs

**Release:**
**Tracking:** [AV-073]
**Code changes:** ZERO (doc-only fix)

## Finding

During exhaustive line-by-line code review, found that all 3 deployment
runbooks told operators to set `SHIPPO_FROM_STREET1` but the code reads
`process.env.SHIPPO_FROM_STREET`. Operator following the runbooks would
hit "Shippo sender address not configured" on first label purchase.

Additionally, all 3 runbooks listed `SHIPPO_FROM_PHONE` which the code
never reads. Removed to prevent confusion.

## Fix

Changed `SHIPPO_FROM_STREET1` → `SHIPPO_FROM_STREET` in:
- `PATH_1_AWS_RUNBOOK.md`
- `PATH_2_VERCEL_RAILWAY_RUNBOOK.md`
- `docs/PRE_LAUNCH_CHECKLIST.md`

Removed `SHIPPO_FROM_PHONE` from all three.

The `DEPLOYMENT_GUIDE.md` already had the correct name (`SHIPPO_FROM_STREET`).

## Full audit summary (what this review covered)

146 JS/JSX files parsed. Every route, middleware, service, validator,
frontend component, and config file read line by line. Three bugs found
total across the entire engagement:

| # | Bug | Severity | Fixed in |
|---|---|---|---|
| 1 | `extractOptionalUserId` read wrong JWT field | CRITICAL | v5.5.3 |
| 2 | `shared/constants/` missing from bundle | CRITICAL | v5.5.3 |
| 3 | Shippo env var name mismatch in docs | LOW | v5.5.4 (this release) |

Everything else reviewed clean. No further code changes needed.
