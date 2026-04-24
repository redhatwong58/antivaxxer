# v5.5.1 — Final QA + UAT pass + handover bundle

**Release:**
**Tracking:** [AV-070]
**Migration required:** NO
**Code changes:** ZERO (documentation + bundling only)

## Why this release exists

The user requested a full QA + UAT pass before launch. During the pass,
two real handover gaps surfaced:

1. **Changelogs v5.4.1 through v5.4.6 missing from active workspace.**
   Each release zip shipped its own changelog to the operator, but the
   active workspace only retained changelogs that were modified in
   later releases. Reconstructed all 6 from VERSION_NAMING.md + commit
   history + actual code state.

2. **VERSION_NAMING.md table stopped at v5.4.7.** Releases v5.4.8, 5.4.9,
   and 5.5.0 didn't update the master version table. Added 4 rows
   (5.4.8, 5.4.9, 5.5.0, 5.5.1).

This release packages everything an operator needs in one zip:
complete codebase + all 17 changelogs + all 10 docs + dev mocks +
configuration files. No need to apply releases sequentially anymore.

## QA + UAT verification (this release)

- **Parse:** 146/146 JS/JSX files PASS
- **JSON config:** 7/7 valid
- **YAML config:** 4/4 valid (docker-compose, validate.yml, amplify.yml, apprunner.yaml)
- **Cross-version invariants:** 36/37 PASS, 1 false fail (regex matched a code comment; verified manually)
- **User-journey regression:** 60/60 PASS, 0 fail, 0 info across 8 categories
- **Documentation cross-references:** all links resolve

## Honest list of what cannot be verified from a sandbox

| Cannot verify | Mitigation |
|---|---|
| `npm install` resolves all deps | All package versions are real published versions |
| Tests actually execute and pass | Test files parse correctly; standard mocking patterns |
| Playwright launches and runs | Standard Playwright API; selectors verified against actual page source |
| Docker images pull and start | All images are official/well-known |
| Real Stripe + SES integration | Requires real test-mode credentials |

These are the operator's responsibility per `PRE_LAUNCH_CHECKLIST.md`
Section F (smoke test).

## Bundle structure

    av-v5.5.1/
    ├── api/                  ← Express backend, 50 files
    ├── frontend/             ← Next.js storefront + admin, 106 files
    ├── dev/                  ← Mailchimp stub for local dev
    ├── docs/                 ← All 10 documentation files
    ├── changelogs/           ← All 17 release changelogs
    ├── .github/workflows/    ← CI validation (if present)
    ├── docker-compose.yml    ← Local dev services
    ├── .env.dev.example      ← Local dev env template
    ├── package.json          ← Root npm workspace config
    ├── amplify.yml           ← AWS Amplify build spec
    ├── apprunner.yaml        ← AWS App Runner config
    └── README.md             ← Start here

## Where to start

**If you're a new developer inheriting this project:**
Read `docs/README.md` first. It has a Documentation Map that tells you
which doc to read for which task.

**If you're the operator deploying to production for the first time:**
Read `docs/PRE_LAUNCH_CHECKLIST.md`. It walks through every operator
setup task with verification steps.

**If you want to run the project locally:**
Read `docs/SETUP.md`. Five steps: `docker compose up -d`, env file,
migrations, API server, frontend server.

## What's done — entire engagement summary

15 feature releases (v5.3.4 through v5.5.0) + 1 doc release (v5.4.7) +
this final QA pass (v5.5.1) = 17 deliveries.

Every item from the original feature scope, the error-handling audit,
the testing column, and the documentation handover is closed. The
GAP_TRACKER section 3 is fully struck through.

## What's NOT in this engagement

These were noted in GAP_TRACKER as "Not yet built — features" or
deferred entirely. They were never in scope but listed for visibility:

- Product reviews (data model + moderation UI)
- Order lookup for guests
- Product recommendations ("you might also like")
- Loyalty program (deferred — explicitly out of scope per stakeholder)
- Subscriptions / recurring orders (deferred)
- Multi-currency / multi-language / international shipping (deferred for launch)

These are documented in `docs/SITE_WORKFLOW_SPEC.md` section 14.6 + 14.7
for future reference.
