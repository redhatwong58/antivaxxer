# v5.4.6 — Full regression + Cloudflare Turnstile wiring

**Release:**
**Tracking:** [AV-065]
**Migration required:** NO

> Reconstructed during v5.5.1 handover bundle pass.

## Summary
Full end-to-end regression scan across 8 user-journey categories (60 individual checks).

**59 features verified working as designed.**
**1 real bug found:** Cloudflare Turnstile was documented as `✅ BUILT` but middleware was never mounted on routes and frontend forms had no widget.
**2 documentation inaccuracies** also corrected.

All three fixed in this release.

## Cloudflare Turnstile — now actually wired

### Backend
`api/src/index.js` mounts `turnstileVerify` on `/api/auth`. Middleware (already existed) verifies token against Cloudflare's siteverify endpoint before the auth handler runs.

### Frontend
- NEW `frontend/src/components/auth/TurnstileWidget.js` — vanilla Cloudflare script loader, no extra npm dep
- Wired into `/account/register` and `/account/login`
- NextAuth credentials provider (`frontend/src/lib/auth.js`) updated to forward `turnstileToken` to `/api/auth/login`

### Graceful degradation (4 layers)
1. If `NEXT_PUBLIC_TURNSTILE_SITE_KEY` unset on frontend, widget renders nothing and immediately calls onVerify with placeholder
2. If `TURNSTILE_SECRET_KEY` unset on backend, middleware skips verification
3. If Cloudflare's API is down, backend allows request through with warning log
4. If script fails to load, frontend allows submit with placeholder token

### New env vars
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY` (frontend)
- `TURNSTILE_SECRET_KEY` (API)

Both optional in dev, required in production for actual bot protection.

## Doc accuracy fixes
- 9.5 Low-stock alert — removed "(service only, not wired)"; alerts ARE wired in webhooks.js
- 10.3 Lambda function template — changed from `✅ BUILT` to `📋 RECIPE`; clarified the 10-line snippet is operator infra
- 13.5 Cloudflare Turnstile — expanded with full v5.4.6 wiring details

## Files changed
- `api/src/index.js` (+1 import, +1 middleware mount on /api/auth)
- `frontend/src/components/auth/TurnstileWidget.js` (NEW)
- `frontend/src/app/account/register/page.js` (widget + token state)
- `frontend/src/app/account/login/page.js` (widget + token state)
- `frontend/src/lib/auth.js` (turnstileToken credential field)
- `SITE_WORKFLOW_SPEC.md` (5 surgical edits)

## Validation
- Parse: 5/5 PASS
- Structural QA: 27/27 PASS
- Full regression: 60/60 PASS
