# Contributing

Guidelines and conventions for working on the ANTIVAXXER codebase.

---

## Branch Strategy

```
main              ← production-ready, deploys automatically
├── develop       ← integration branch for upcoming release
│   ├── feature/* ← new features
│   ├── fix/*     ← bug fixes
│   └── chore/*   ← maintenance, deps, docs
```

Create branches from `develop`. Open PRs back into `develop`. Merge `develop` into `main` for releases.

---

## Commit Messages

Use conventional commit format:

```
type(scope): description

feat(checkout): add express shipping option
fix(auth): resolve JWT expiration bug in token refresh
chore(deps): update prisma to 5.x
docs(readme): add deployment cost estimates
```

Types: `feat`, `fix`, `chore`, `docs`, `style`, `refactor`, `test`, `perf`.

---

## Project Conventions

### API (`api/`)

- Route files live in `api/src/routes/`.
- Shared middleware in `api/src/middleware/`.
- JWT configuration is centralized in `api/src/lib/jwt.js` — import from there, never hardcode secrets or expiration in individual files.
- Use Prisma Client for all database access; avoid raw SQL unless necessary for performance (e.g., `pg_trgm` search).
- Stripe webhook handlers go in the webhooks route file and must verify signatures using `STRIPE_WEBHOOK_SECRET`.

### Frontend (`frontend/`)

- Pages use the Next.js App Router (`app/` directory).
- Reusable components in `components/`.
- API calls go through a centralized fetch utility or API client module.
- Environment variables exposed to the browser must be prefixed with `NEXT_PUBLIC_`.

### Database

- Never modify migration files after they've been committed.
- To change the schema: edit `prisma/schema.prisma`, then run `npx prisma migrate dev --name descriptive_name`.
- Seed data lives in `prisma/seed.js` (or `seed.ts`).

---

## Rollback Protocol

Before making large changes (especially to the frontend UI):

1. Create a rollback snapshot:
   ```bash
   mkdir -p _rollback/v$(date +%Y%m%d)
   cp -r frontend/src/components _rollback/v$(date +%Y%m%d)/
   ```

2. Document which files were changed in the snapshot directory.

3. To rollback: copy the snapshot files back into `frontend/`.

The `_rollback/v5.1.0/` directory contains the pre-UI-overhaul state and can be restored with a simple copy.

---

## Security Practices

- Never commit `.env` files or secrets. Use `.env.example` as the template.
- All authentication tokens must use the centralized JWT config in `api/src/lib/jwt.js`.
- Always verify Stripe webhook signatures before processing events.
- Admin endpoints must check for admin role in the JWT payload.
- User input that touches the database must be validated and sanitized.
- Use parameterized queries (Prisma handles this) — never interpolate user input into SQL.

---

## Testing

Run the test suite before submitting a PR:

```bash
npm test
```

At minimum, test:
- Authentication flows (registration, login, token refresh)
- Stripe payment intent creation and webhook processing
- Promo code validation and per-user usage limits
- Inventory alert threshold triggers
- Abandoned cart detection logic

---

## Code Review Checklist

- [ ] No secrets or credentials in the diff
- [ ] Database migrations are additive (no destructive changes without a migration plan)
- [ ] JWT configuration imports from `api/src/lib/jwt.js`
- [ ] Stripe webhook handlers verify signatures
- [ ] Frontend environment variables use `NEXT_PUBLIC_` prefix if browser-accessible
- [ ] New API routes have appropriate authentication middleware
- [ ] Error handling doesn't leak stack traces or internal details to clients
