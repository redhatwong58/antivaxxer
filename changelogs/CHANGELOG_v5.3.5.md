# v5.3.5 — Admin auth gate + Forgot password

**Release:**
**Tracking:** [AV-049] admin auth gate, password reset flow

## Summary

Two security/UX gaps closed:

1. **Admin auth gate** — the `/admin` frontend layout had no auth check.
   Anyone could hit `/admin` and see the UI. The API was already locked
   down (`adminAuth` middleware on `/api/admin/*`), but the frontend
   pages exposed structure, navigation, and would have shown stale-cached
   data on revisits. Now hard-gated server-side.

2. **Forgot password** — did not exist. No routes, no pages, no token
   storage. Now end-to-end: backend routes, email, frontend pages,
   schema migration.

## Changes

### Frontend — admin auth gate

- **NEW** `frontend/src/lib/auth.js` — extracted `authOptions` from the
  NextAuth route handler so server components can call
  `getServerSession(authOptions)` without circular imports.
- **CHANGED** `frontend/src/app/api/auth/[...nextauth]/route.js` —
  slimmed down to a re-export of the shared `authOptions`. Behavior
  identical, just refactored.
- **CHANGED** `frontend/src/app/admin/layout.js` —
    - Converted from a static layout to a server component
    - Calls `getServerSession(authOptions)` on every request
    - Redirects to `/account/login?callbackUrl=/admin` when no session
    - Redirects to `/403` when session exists but `role !== 'admin'`
    - `dynamic = 'force-dynamic'` so the check runs on every request
      (not cached)
    - Nav expanded to: Dashboard, Products, Inventory, Orders, Promos,
      Customers (matches the admin pages the product owner asked for —
      pages themselves come in v5.3.6)
    - Shows the signed-in admin's email in the header
- **NEW** `frontend/src/app/403/page.js` — simple forbidden page,
  red "ACCESS DENIED" with a link back to the site.

### Forgot password — backend

- **CHANGED** `api/prisma/schema.prisma` — added two fields to the
  `User` model:
    - `resetTokenHash` (varchar 64, indexed) — SHA-256 of the raw token
    - `resetTokenExpiresAt` (timestamp, nullable) — 1-hour TTL
- **NEW** `api/prisma/migrations/20260414000000_add_password_reset/migration.sql` —
  ALTER TABLE adding both columns and the index.
- **CHANGED** `api/src/routes/auth.js` — added two endpoints:
    - `POST /api/auth/forgot-password`
        - Generates 32-byte random token, hashes with SHA-256, stores
          hash + 1-hour expiry on user row
        - Calls `sendPasswordResetEmail` with the raw token in the URL
        - **Always returns 200** with the same generic message regardless
          of whether the email is registered (prevents account enumeration)
        - Re-requesting overwrites the previous token (invalidates the
          previous email)
    - `POST /api/auth/reset-password`
        - Hashes the submitted token with SHA-256, looks up user by hash
          (indexed)
        - Verifies expiry (clears expired tokens to prevent reuse)
        - Hashes new password with bcrypt cost 12
        - Clears the reset token fields on success
- **CHANGED** `api/src/services/email.js` — added `sendPasswordResetEmail`
  function (HTML + text body, brand-styled, 1-hour expiry messaging).

### Forgot password — frontend

- **NEW** `frontend/src/app/account/forgot-password/page.js` —
    - Single email field
    - Posts to `/auth/forgot-password`
    - Shows generic "CHECK YOUR EMAIL" success regardless of whether the
      email exists (matches backend's anti-enumeration behavior)
    - Link back to login
- **NEW** `frontend/src/app/account/reset-password/[token]/page.js` —
    - Reads token from URL param via `useParams`
    - Two password fields (new + confirm) with client-side validation
      (min 8 chars, must match)
    - Posts to `/auth/reset-password`
    - On success: shows confirmation, redirects to login after 2.5s
    - On expired/invalid token: shows error with "Request a new link" CTA
- **CHANGED** `frontend/src/app/account/login/page.js` — added a
  "Forgot password?" link below the password field linking to
  `/account/forgot-password`.

### Documentation correction

- **CHANGED** `_rollback/v5.3.3/components/product/ProductCard.js`
  restored to the correct pre-v5.3.4 version. (I had deleted it in error
  while debugging a discrepancy noted in the v5.3.4 QA — the rollback
  was actually correct, my changelog description of v5.3.4 was the part
  that didn't match the on-disk file. Both are now consistent.)

## Files changed
- `frontend/src/lib/auth.js` (new)
- `frontend/src/app/api/auth/[...nextauth]/route.js` (refactored)
- `frontend/src/app/admin/layout.js` (auth gate added)
- `frontend/src/app/403/page.js` (new)
- `frontend/src/app/account/login/page.js` (forgot password link)
- `frontend/src/app/account/forgot-password/page.js` (new)
- `frontend/src/app/account/reset-password/[token]/page.js` (new)
- `api/src/routes/auth.js` (forgot/reset endpoints)
- `api/src/services/email.js` (sendPasswordResetEmail)
- `api/prisma/schema.prisma` (User reset fields)
- `api/prisma/migrations/20260414000000_add_password_reset/migration.sql` (new)

## Rollback

```bash
# Frontend
cp _rollback/v5.3.4/app/api/auth/\[...nextauth\]/route.js \
   frontend/src/app/api/auth/\[...nextauth\]/route.js
cp _rollback/v5.3.4/app/admin/layout.js \
   frontend/src/app/admin/layout.js
rm frontend/src/lib/auth.js
rm -rf frontend/src/app/403
rm -rf frontend/src/app/account/forgot-password
rm -rf frontend/src/app/account/reset-password
# Manually remove the "Forgot password?" link from login/page.js

# Backend (you must also rollback the DB migration)
# ROLLING BACK v5.3.5 RE-EXPOSES /admin TO ANYONE.
# Only roll back if absolutely necessary and you're aware of the risk.
```

## Validation

53/53 structural checks pass. JSX parsed via `@babel/parser`, CommonJS
parsed via `new Function()`. See `validation-report-v5.3.5.txt` in this
zip for the full output.

## Deployment notes

1. **Run the Prisma migration** before deploying the API:
   ```bash
   cd api && npx prisma migrate deploy
   ```
   Or for dev: `npx prisma migrate dev`.

2. **Required environment variables** (already set in v5.3.4, double-check):
    - `NEXTAUTH_SECRET` — used to sign JWTs (frontend)
    - `JWT_SECRET` — used by API to verify the same JWTs
    - `SES_FROM_EMAIL` — verified sender for password reset emails
    - `NEXT_PUBLIC_SITE_URL` — used in the reset link (e.g.
      `https://antivaxxer.com`)
    - `NEXT_PUBLIC_API_URL` — used by frontend to call the API

3. **First admin user**: there's no UI to promote a user to admin yet
   (Session B+). Set the role manually after registration:
   ```sql
   UPDATE users SET role = 'admin' WHERE email = 'you@antivaxxer.com';
   ```

## What's NOT in this release

Documented for the next session:

- Admin pages themselves: Dashboard, Inventory, Promos, Customers
  (only the nav links exist, the pages 404 until v5.3.6)
- Product status enum extension (`coming_soon` / `prelaunch`)
- Order line-item editing UI with price recalc
- Top sellers query for the dashboard
- Customer drill-down UI
- Shippo integration for `shipped`/`delivered` status sync
- Stripe webhook → `processing` transition
