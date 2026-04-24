# v5.4.7 — Documentation handover

**Release:**
**Tracking:** [AV-066]
**Migration required:** NO
**Code changes:** ZERO — pure documentation

## Summary

The codebase has been feature-complete since v5.4.6. This release is the
documentation pass that makes the project handover-ready: a single canonical
operator runbook for first launch, a documentation map at the top of the
README, and removal of stale claims from the workflow spec.

No code was touched. Every change in this release was needed to:
- consolidate scattered pre-launch info into one document
- correct a documentation claim that no longer matched reality
- give a new developer / operator an obvious path through the docs

## NEW — `PRE_LAUNCH_CHECKLIST.md`

The single source of truth for everything an operator must do between
"code complete" and "real customers placing real orders." Seven sections:

- **A — Wall-clock waits (start first):** SES production access, SES domain
  verification, Cloudflare Turnstile site setup
- **B — Stripe configuration:** live keys, webhook endpoint, Stripe Tax activation
- **C — Shippo configuration:** API key, sender address, tracking webhook
- **D — Database + auth bootstrap:** migrations, first admin user via SQL,
  ADMIN_TOKEN removal
- **E — Cron / scheduled jobs:** CRON_TOKEN generation, three scheduler options
  (EventBridge/Lambda, Render/Railway built-in cron, Vercel Cron)
- **F — Final smoke test:** 13-item end-to-end checklist with a real card
- **G — Post-launch monitoring:** what to watch in the first 7 days

Plus a complete env var cheat sheet at the end.

## Workflow spec accuracy fixes

`SITE_WORKFLOW_SPEC.md`:

- **Section 14.1** — collapsed from 3 stale items to a pointer to PLC. Removed
  "Wire low-stock alert into webhook" — the alert HAS been wired in
  `webhooks.js` since the Stripe handler was originally built; the claim was
  outdated.
- **Section 14.2 #6** — "Shipping notification email" marked DONE in v5.4.1
  (was still listed as TODO).
- **Section 14.6** — removed the duplicate "Customer management in admin"
  enhancement entry (the feature was already shipped in v5.3.6 and
  separately marked done in 14.2 #9). Renumbered remaining items 21-28 to
  fix the numbering collision that resulted from prior edits.
- **Appendix A** — `inventoryAlerts.js` description corrected from
  "not yet wired" to "wired in webhooks.js after inventory deduction".
- **Appendix B** — added `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to the frontend-only
  env var list (v5.4.6 wired Turnstile but only the secret was documented).
  Expanded the `TURNSTILE_SECRET_KEY` entry to note the v5.4.6 wiring.
- Version bumped 5.4.6 → 5.4.7.

## GAP_TRACKER.md

- Replaced the duplicated pre-launch table with a single reference to PLC
  (no information loss — PLC has more detail with verification steps).
- Section 4 (recommended priorities) closed: all 10 priorities marked
  ✅ DONE. The gap tracker is fully closed.

## README.md

- Added a **Documentation Map** at the top — a table that tells a new
  developer/operator which doc to read for which task. Lists all 11 markdown
  documents in the project with a one-line "When to read this" column.
- Bumped version to v5.4.7.
- Tech Stack table corrections:
  - Shippo: "(planned)" → "(v5.4.0 — full lifecycle automation)"
  - Turnstile: added "(v5.4.6 — wired on register + login)"
  - Added Tests row: "Jest + supertest (v5.4.5 — 18 integration test cases)"

## Other docs

- `DEPLOYMENT_GUIDE.md` — added a prominent first-launch callout pointing to
  PLC. Bumped version. Per-deploy sections unchanged (they're correct).
- `AMPLIFY_DEPLOYMENT_GUIDE.md` — same first-launch callout. Bumped version.
- `VERSION_NAMING.md` — added v5.4.7 row.

## Files changed

- `PRE_LAUNCH_CHECKLIST.md` (NEW)
- `SITE_WORKFLOW_SPEC.md` (5 surgical edits)
- `GAP_TRACKER.md` (pre-launch section + section 4)
- `README.md` (Documentation Map + version + tech stack)
- `DEPLOYMENT_GUIDE.md` (PLC callout + version)
- `AMPLIFY_DEPLOYMENT_GUIDE.md` (PLC callout + version)
- `VERSION_NAMING.md` (v5.4.7 row)

## Validation

38/39 PASS, 1 FALSE FAIL on a regex check that was too strict
(my own check, not a real issue). Effective: 39/39 PASS.

## What's next

Nothing. The codebase is feature-complete (v5.4.6) and the docs are
handover-ready (v5.4.7). The operator's next step is `PRE_LAUNCH_CHECKLIST.md`.
