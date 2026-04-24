# v5.5.2 — Unified launch runbooks (AWS + Vercel/Railway)

**Release:**
**Tracking:** [AV-071]
**Migration required:** NO
**Code changes:** ZERO (documentation only)

## Why this release

The user asked for both AWS and Vercel/Railway deployment paths
documented as unified sequential runbooks — folding together the
infrastructure setup AND the operator phases (SES, Stripe, Shippo,
first admin user, etc.) into single docs you can follow start-to-finish
without context-switching.

Previously, an operator deploying to AWS had to read:
- `AMPLIFY_DEPLOYMENT_GUIDE.md` for AWS infra (12 phases)
- `PRE_LAUNCH_CHECKLIST.md` for operator setup (7 sections)
- `DEPLOYMENT_GUIDE.md` for per-deploy mechanics

And mentally interleave them. The new unified runbooks fold all three
into one ordered sequence per path.

## Three new documents

### `CHOOSE_DEPLOYMENT_PATH.md` (~3 KB)
2-minute decision doc. Explains the 30-second criteria for picking
between AWS and Vercel/Railway. Includes side-by-side comparison table
and an honest recommendation specifically for ANTIVAXXER (Vercel/Railway
for most launches; AWS only when there's a specific reason).

### `PATH_1_AWS_RUNBOOK.md` (~17 KB)
**8-12 hour AWS launch runbook**, 7 sequential stages:

- Stage 0: Pre-flight (account, billing, region)
- Stage 1: Wall-clock waits (SES approval, domain verification, Turnstile setup)
- Stage 2: AWS infrastructure (VPC, RDS, S3, CloudFront, IAM, Secrets Manager)
- Stage 3: Stripe + Shippo + Cloudflare config
- Stage 4: Deploy API to App Runner + run migrations
- Stage 5: Deploy frontend to Amplify + custom domain
- Stage 6: First admin user + cron + final smoke test
- Stage 7: Post-launch monitoring

Includes complete IAM policies, Secrets Manager secret list (15 entries
with example ARNs), rollback procedures, cost estimate ($50-90/mo), and
the 13-item final smoke test.

### `PATH_2_VERCEL_RAILWAY_RUNBOOK.md` (~14 KB)
**2-4 hour managed PaaS launch runbook**, same 7-stage structure but
substantially shorter because the platforms handle most infrastructure:

- Uses Vercel for frontend (git push deploys)
- Uses Railway for API + Postgres (git push deploys)
- Uses AWS only for SES + S3 (the "AWS sliver")
- Three cron options (Railway built-in, Vercel Cron, external service)
- Explicit "when to migrate to AWS" section
- Cost estimate $10-40/mo

## README updated

The Documentation Map now lists all 3 new docs at the top with the
recommended next step for first launches.

## Validation

Structural QA: 35/35 PASS
Regression: 60/60 PASS (zero existing functionality broken)

## Files

- `CHOOSE_DEPLOYMENT_PATH.md` (NEW)
- `PATH_1_AWS_RUNBOOK.md` (NEW)
- `PATH_2_VERCEL_RAILWAY_RUNBOOK.md` (NEW)
- `README.md` (Documentation Map updated)
