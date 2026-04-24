# v5.3.7 — Order line-item editing, product statuses, webhook auto-transition

**Release:**
**Tracking:** [AV-051] product status, [AV-052] webhook transition, [AV-053] line-item editing

## Summary

Three major admin/storefront improvements:

1. **Order line-item editing** — admins can now edit, add, or remove items on existing orders with full transaction-safe stock adjustment, recalculation, and audit trail. Refuses to edit shipped/delivered orders.

2. **Product statuses `coming_soon` and `prelaunch`** — extends the existing active/draft/archived statuses. Storefront PDP and ProductCard render appropriate badges and buy-button behavior. No data migration needed.

3. **Stripe webhook → `processing` auto-transition** — Stripe payment success now moves orders straight to `processing` instead of `paid`. The intermediate `paid` state served no purpose in the real workflow.

## Changes

### Backend — order line-item editing

**`api/src/routes/admin.js`** — new `PUT /api/admin/orders/:id/items` endpoint (~210 lines):

- Body: `{ items: [{ variantId, quantity }] }` — full replacement model
- Refuses to edit orders in `shipped/delivered/cancelled/refunded` status (409 NOT_EDITABLE) — the items are physically out the door
- **Pre-validates stock** for any added/increased items before any DB writes (returns 409 INSUFFICIENT_STOCK with available count)
- Computes the diff against current items: added / removed / quantity changed
- Inside a single Prisma transaction:
  - Restocks removed items (`variant.stockQty += quantity`, deletes `OrderItem`)
  - Decrements stock for added items, creates new `OrderItem` rows with current variant price
  - Adjusts stock by delta for quantity changes, updates `OrderItem.quantity`
  - Recalculates `subtotal` from updated items
  - Recalculates `total = subtotal - discount + shipping + tax`
  - Appends a timestamped audit line to `order.notes` with admin email + full diff
- Handles edge cases:
  - Empty items array → 400 (cancel the order instead)
  - Duplicate `variantId` in submission → sums quantities
  - Variant doesn't exist → 400 VARIANT_NOT_FOUND
  - No actual changes → 400 NO_CHANGES (prevents unnecessary audit clutter)

**Schema audit:** every Prisma field reference in the new endpoint was verified against `schema.prisma`. 16/16 fields confirmed (OrderItem.orderId/variantId/productName/colorName/sizeName/sku/quantity/unitPrice, Variant.stockQty, Order.subtotal/total/notes/discountAmount/shippingAmount/taxAmount, Product.basePrice). Lesson from v5.3.6: read the schema before writing the query, not after.

**What's NOT recalculated:**
- 🔴 **Tax** — recalculating tax retroactively on an already-billed order creates legal/accounting problems
- 🔴 **Shipping** — same reasoning
- 🔴 **Discount/promo** — preserved as-is

Admin must adjust those separately via refund or new charge if needed.

### Frontend — order line-item editing

**`frontend/src/app/admin/orders/[id]/page.js`** — full edit-mode UI:

- New state: `editingItems`, `draftItems`, `savingItems`, `itemError`, `showVariantPicker`, `variantSearch`, `allProducts`, `productsLoaded`
- New handlers: `startEditingItems`, `cancelEditingItems`, `updateDraftQuantity`, `removeDraftItem`, `addDraftItem`, `openVariantPicker`, `saveItems`
- Edit button toggles between read-only and edit modes
- For shipped+ orders: button replaced with "Locked (status)" label
- Edit mode renders inline quantity inputs, remove buttons, NEW badges on added items
- "+ Add Item" button opens a variant picker that lazy-loads `/api/admin/products` on first open
- Variant picker is searchable (product name / SKU / color / size), shows only active variants with stock > 0, capped at 50 results
- Live recalculated subtotal and total preview update as the admin edits
- Save button calls `PUT /api/admin/orders/:id/items` and refreshes the order
- Cancel button discards changes

### Backend — product status extension

**`api/src/validators/products.js`** — public status enum extended:
```diff
- status: z.enum(['active', 'draft', 'archived']).optional().default('active'),
+ status: z.enum(['active', 'draft', 'archived', 'coming_soon', 'prelaunch']).optional(),
```
Removed the hardcoded `'active'` default so the route handler can decide the default based on context.

**`api/src/routes/products.js`** — public listing default:
```js
const PUBLIC_STATUSES = ['active', 'coming_soon', 'prelaunch'];
const where = status
  ? { status }
  : { status: { in: PUBLIC_STATUSES } };
```
When no `?status=` is passed, returns all publicly-visible statuses. Existing callers passing `?status=active` still get only purchasable items.

**`api/src/validators/admin.js`** — admin write enum extended to match.

### Frontend — product status handling

**`frontend/src/app/admin/products/[id]/page.js`** — status dropdown extended with two new options and friendly labels:
```jsx
<option value="draft">Draft (hidden)</option>
<option value="active">Active</option>
<option value="coming_soon">Coming Soon (visible, no buy)</option>
<option value="prelaunch">Pre-Launch (visible, pre-order)</option>
<option value="archived">Archived (hidden)</option>
```

**`frontend/src/app/admin/products/page.js`** — status filter dropdown extended, badge styles for blue (`coming_soon`) and purple (`prelaunch`), friendly label map ("coming soon" / "pre-launch").

**`frontend/src/components/product/ProductCard.js`** — destructures `status`, computes `isComingSoon`/`isPrelaunch`/`allowQuickAdd`, renders status badge taking priority over manual badge:
- `coming_soon` → blue "COMING SOON" badge, no Quick Add button (purchase entirely disabled)
- `prelaunch` → purple "PRE-ORDER" badge, Quick Add button relabeled "PRE-ORDER" (still adds to cart)
- `active` → unchanged

**`frontend/src/app/shop/[slug]/page.js`** — PDP buy button branches:
- `coming_soon` → non-clickable blue "Coming Soon" placeholder, "In Stock" line hidden
- `prelaunch` → red "Pre-Order — $XX" button (still adds to cart), "In Stock" line replaced with "Pre-Order — ships at launch"
- `active` → unchanged

### Backend — Stripe webhook → processing transition

**`api/src/routes/webhooks.js`** — payment success now sets status to `processing` instead of `paid`:

```diff
- await prisma.order.update({
-   where: { id: order.id },
-   data: { status: 'paid' },
- });
+ await prisma.order.update({
+   where: { id: order.id },
+   data: { status: 'processing' },
+ });
```

The intermediate `paid` state was always immediately followed by `processing` in real workflows. Eliminating the manual ops step saves time and reduces error.

**Backward compatibility:** all existing references to `'paid'` in admin routes are part of `IN` filters (e.g. `status: { in: ['paid', 'processing', 'shipped', 'delivered'] }`), so legacy `paid` orders still count as revenue, still appear in fulfillment counts, etc. Only the new orders skip `paid`.

## Files changed
- `api/src/routes/admin.js` (+210 lines — new line-item editing endpoint)
- `api/src/routes/webhooks.js` (1 line + comment — status transition)
- `api/src/routes/products.js` (4 lines — PUBLIC_STATUSES default)
- `api/src/validators/products.js` (enum + default change)
- `api/src/validators/admin.js` (enum change)
- `frontend/src/app/admin/products/[id]/page.js` (5 dropdown options)
- `frontend/src/app/admin/products/page.js` (filter options + badge styles + label map)
- `frontend/src/components/product/ProductCard.js` (status badge logic + Quick Add gating)
- `frontend/src/app/shop/[slug]/page.js` (PDP buy button branching)
- `frontend/src/app/admin/orders/[id]/page.js` (full edit-mode UI)

## Validation

- **5/5 frontend parse** (Babel @babel/parser with JSX plugin)
- **5/5 backend parse** (CommonJS via `new Function`)
- **16/16 schema audit** — every Prisma field reference in the new line-item endpoint verified against `schema.prisma`
- **48/48 structural QA** — endpoint behavior, frontend wiring, status branching all verified

See `validation-report-v5.3.7.txt` in this zip for the full output.

## Deployment notes

1. **No env var changes**
2. **No Prisma migration** — product status is a String column, so the new values just work
3. **Pure code deploy** — sync `frontend/` and `api/` into the repo, sync `docs/` to root, deploy

### Smoke test after deploy

| Test | Expected |
|---|---|
| Open `/admin/orders/[id]` of a pending/paid/processing order | "Edit Items" button visible |
| Click "Edit Items" → change a quantity → Save | Order updates, totals recalculated, audit line appended to notes, page refreshes |
| Edit items → "+ Add Item" → search → select | Item added with NEW badge, totals update |
| Edit items → click Remove on an item → Save | Item removed, variant stock incremented, totals update |
| Open `/admin/orders/[id]` of a shipped order | "Locked (shipped)" label instead of edit button |
| Try to over-edit (request more than stock) | Error: "need X more, only Y in stock" |
| Mark a product `coming_soon` in admin → view on storefront | Blue "COMING SOON" badge on card, "Coming Soon" placeholder on PDP, no buy button |
| Mark a product `prelaunch` → view on storefront | Purple "PRE-ORDER" badge on card, "Pre-Order — $XX" button on PDP |
| Place a test order (Stripe test card) → check order status | Goes straight to `processing` (not `paid`) |

## Rollback

See `_rollback/v5.3.6/ROLLBACK.md` for step-by-step revert instructions for each file.

The biggest revert is the new `PUT /api/admin/orders/:id/items` endpoint — it's clearly delimited in `api/src/routes/admin.js` between the comment header and the `// IMAGE MANAGEMENT` section.

## What's NOT in this release (Session D)

- **Shippo end-to-end integration** — automated `processing → shipped → delivered` transitions, label purchase, tracking webhook
- **Per-order ops fulfillment email** — to `contact@antivaxxer.com` on every payment success
- **Stripe Tax** activation — one-line config change
- **Refund button** wiring to Stripe Refund API
