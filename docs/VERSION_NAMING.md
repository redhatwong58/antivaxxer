# ANTIVAXXER — File Naming Convention

## Zip Deliverable Format

```
antivaxxer-v{MAJOR}.{MINOR}.{PATCH}-{DESCRIPTION}.zip
```

### Version Numbers

| Part | When It Increments | Example |
|------|-------------------|---------|
| MAJOR | Phase completion | v1.0.0 (Phase 1), v2.0.0 (Phase 2) |
| MINOR | Step completion within a phase | v1.1.0 (Step 1), v1.2.0 (Step 2) |
| PATCH | Bug fix, doc update, or correction within a step | v1.2.1 (fix in Step 2) |

### Description

Short lowercase label after the version. No spaces, use hyphens.

### Examples

```
antivaxxer-v1.0.0-phase1-complete.zip      ← Phase 1 final delivery
antivaxxer-v2.1.0-stripe-checkout.zip       ← Phase 2, Step 1 (Stripe)
antivaxxer-v2.1.1-stripe-webhook-fix.zip    ← Bug fix within that step
antivaxxer-v2.2.0-order-creation.zip        ← Phase 2, Step 2
antivaxxer-v2.0.0-phase2-complete.zip       ← Phase 2 final delivery
```

### Retroactive Phase 1 Versions (for reference only)

| Delivered As | Should Have Been |
|-------------|-----------------|
| antivaxxer-step1-scaffolding.zip | antivaxxer-v1.1.0-scaffolding.zip |
| antivaxxer-steps1-3.zip | antivaxxer-v1.3.0-seed-script.zip |
| antivaxxer-steps1-4.zip | antivaxxer-v1.4.0-product-api.zip |
| antivaxxer-steps1-5a.zip | antivaxxer-v1.5.0-core-layout.zip |
| antivaxxer-steps1-5b.zip | antivaxxer-v1.6.0-product-grid.zip |
| antivaxxer-steps1-5c.zip | antivaxxer-v1.7.0-modal-cart.zip |
| antivaxxer-steps1-5d.zip | antivaxxer-v1.8.0-static-pages.zip |
| antivaxxer-steps1-6.zip | antivaxxer-v1.9.0-admin-list.zip |
| antivaxxer-phase1-complete.zip | antivaxxer-v1.0.0-phase1-complete.zip |

### Rules

- Every zip delivered to the user follows this format going forward
- The description should be 2-4 words max, descriptive of what changed
- Patch versions only for fixes to already-delivered steps, not new work
- Phase completion zips use x.0.0 format

---

## Release Log (Phase 5+)

| Version | Zip | Date | Summary |
|---------|-----|------|---------|
| v5.3.3 | antivaxxer-v5.3.3-wishlist-and-modal.zip | — | Wishlist feature + ProductModal redesign |
| v5.3.4 | antivaxxer-v5.3.4.zip | — | US Medical Liberty Map (50 states, ICAN bolded, hover outline fix) + Quick Add for all products on all devices |
| v5.3.5 | antivaxxer-v5.3.5.zip | — | **SECURITY:** admin frontend auth gate (was unprotected). **NEW:** full password reset flow (backend + email + frontend pages + schema migration). Workflow spec corrected for accuracy. |
| v5.3.6 | antivaxxer-v5.3.6.zip | — | **NEW admin console:** Dashboard (6 stat tiles + top sellers + recent orders + low stock alerts), Inventory page (flattened variant view with search/filter), Promos CRUD UI, Customers list with profile drill-down + order history. Sidebar layout rewrite to match v5.3.3 mock. 5 new backend endpoints. |
| v5.3.7 | antivaxxer-v5.3.7.zip | — | **Order line-item editing** (admin edits items on pending/paid/processing orders with auto-restock, recalc, and audit trail — `PUT /api/admin/orders/:id/items` in transaction). **Product statuses** `coming_soon`/`prelaunch` with PDP/card branching. **Stripe webhook** auto-transitions `pending → processing`. |
| v5.3.8 | antivaxxer-v5.3.8.zip | — | **Stripe refund button** (full + partial with restocking logic, audit trail, Stripe Refunds API integration). **Per-order fulfillment email** to ops with packing slip + color-coded post-deduction stock counts. **Stripe Tax** flag enabled (requires dashboard activation to take effect). |
| v5.3.9 | antivaxxer-v5.3.9.zip | — | **CRITICAL FIXES:** Webhook inventory deduction wrapped in Prisma transaction with `SELECT FOR UPDATE` row locks (eliminates oversell race + partial-deduction state). **FailedWebhook dead-letter queue** with schema, migration, admin recovery UI (`/admin/failed-webhooks`), retry/resolve endpoints, admin alert email. Fixes both CRITICAL items from the error handling audit. |
| v5.4.0 | antivaxxer-v5.4.0.zip | — | **Shippo end-to-end:** Service file (`createShipment`/`purchaseLabel`), schema migration (5 fields on Order), admin endpoints for shipment creation + label purchase, frontend rate selection + label download UI on order detail page, Shippo tracking webhook (`DELIVERED` → auto-transition to delivered). Full order lifecycle now automated. |
| v5.4.1 | antivaxxer-v5.4.1.zip | — | Email stack: welcome, shipping notification (Shippo + manual), delivery confirmation. |
| v5.4.2 | antivaxxer-v5.4.2.zip | — | Honesty fixes: newsletter API stops lying, NewsletterSection + PromoPopup check res.ok, Stripe SDK centralized with timeout + retries. |
| v5.4.3 | antivaxxer-v5.4.3.zip | — | Wishlist sync retry queue (sessionStorage-backed). |
| v5.4.4 | antivaxxer-v5.4.4.zip | — | Request ID middleware, structured JSON error logs, DB transient error retry helper. |
| v5.4.5 | antivaxxer-v5.4.5.zip | — | Integration tests: webhook tx (7 cases), refund (6), line-items (5). Jest + supertest. |
| v5.4.6 | antivaxxer-v5.4.6.zip | — | Full regression scan + Cloudflare Turnstile actually wired (was documented but unwired). Doc accuracy fixes for 9.5/10.3/13.5. |
| v5.4.7 | antivaxxer-v5.4.7.zip | — | Documentation handover: PRE_LAUNCH_CHECKLIST.md as single source of truth for operator launch tasks. Final accuracy pass on workflow spec section 14 (removed 4 stale items, fixed numbering). README documentation map. |
| v5.4.8 | antivaxxer-v5.4.8.zip | — | Local mock services for offline dev: docker-compose with stripe-mock + aws-ses-v2-local + custom Mailchimp stub. Three optional env vars route SDKs to localhost when set, real services when unset. |
| v5.4.9 | antivaxxer-v5.4.9.zip | — | E2E checkout test using Playwright + real Stripe test mode. One spec covering full guest journey from shop → cart → 3-step checkout → Stripe iframe → confirmation page. |
| v5.5.0 | antivaxxer-v5.5.0.zip | — | Component tests for 4 admin pages (Dashboard, Inventory, Promos, Customers). 24 cases using Jest + React Testing Library + jsdom. Closes the entire testing column. |
| v5.5.1 | antivaxxer-v5.5.1.zip | — | Final QA + UAT pass. Reconstructed missing changelogs (v5.4.1-5.4.6). Documentation handover bundle with full release history in one place. No code changes. |
| v5.5.2 | antivaxxer-v5.5.2.zip | — | Deployment runbooks: CHOOSE_DEPLOYMENT_PATH.md, PATH_1_AWS_RUNBOOK.md (AWS Amplify + App Runner), PATH_2_VERCEL_RAILWAY_RUNBOOK.md (Vercel + Railway). |
| v5.5.3 | antivaxxer-v5.5.3.zip | — | **CRITICAL BUGFIXES:** JWT field mismatch in checkout (all logged-in orders silently created as guest), shared/constants/ directory missing from bundle (API startup crash). |
| v5.5.4 | antivaxxer-v5.5.4.zip | — | Doc-only: Shippo env var name corrections (SHIPPO_FROM_STREET not STREET1, removed phantom SHIPPO_FROM_PHONE). |
| v5.5.5 | antivaxxer-v5.5.5-final.zip | — | Email templates: conditional discount row (promo code display) in order confirmation + fulfillment emails. |
| v5.6.1 | antivaxxer-v5.6.1-final.zip | — | **Senior review:** 15 improvements — inStock fix (WS-1/2), checkout parallelization (WS-4), loginLimiter split (WS-13), CORS www + Amplify preview (WS-14), next/image (WS-5), branded 404/error pages, email CTAs, promo JWT extraction (WS-15), apprunner.yaml 15-secret mapping. |
