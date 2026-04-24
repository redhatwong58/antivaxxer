# v5.3.6 — Admin Console (Dashboard, Inventory, Promos, Customers)

**Release:**
**Tracking:** [AV-050] admin console pages, sidebar layout matching mock

## Summary

The four missing admin pages from your original feature list — Dashboard,
Inventory, Promos, Customers — are now built and wired. The admin layout
was also rewritten to match the v5.3.3 stakeholder mock visual language
(left sidebar, Bebas Neue branding, red active state).

## Changes

### Backend — 5 new endpoints, 1 file changed

**`api/src/routes/admin.js`** — added ~290 lines:

1. **`DELETE /api/admin/promos/:id`** — soft-checks for existing usages
   and refuses with 409 IN_USE if any exist. This preserves order history
   integrity. UI shows the error and suggests deactivation instead.

2. **`GET /api/admin/dashboard?days=N`** (default 7) — one-shot consolidated
   payload. Returns:
   - `stats.revenue` (sum of paid+ orders in period)
   - `stats.orderCount`
   - `stats.aov` (average order value)
   - `stats.pendingFulfillment` (paid or processing, any age)
   - `stats.lowStockCount` (variants where stockQty <= lowStockThreshold)
   - `stats.newCustomers` (role=customer created in period)
   - `recentOrders` (last 8)
   - `lowStock` (first 10 below threshold, with product info)
   - `topSellers` (top 5 products by units sold over last 30 days)

   All queries run in parallel via `Promise.all`. Top sellers fetches order
   items through the variant→product join and aggregates by productId in
   JS — see "Bug caught" below.

3. **`GET /api/admin/customers?search=&limit=&offset=`** — paginated
   customer list with case-insensitive search by name or email. Returns
   `orderCount` and `lifetimeSpend` per customer (only counts orders with
   status in paid|processing|shipped|delivered).

4. **`GET /api/admin/customers/:id`** — single customer profile + full
   order history (all statuses). Same lifetime spend aggregation.

**Bug caught and fixed mid-build:** my first version of the top sellers
query used `prisma.orderItem.groupBy({ by: ['productId'], _sum: { lineTotal } })`.
Both `productId` and `lineTotal` are non-existent fields on the `OrderItem`
model — it has `variantId` and `unitPrice`, with `lineTotal` only being
computed in JS for response payloads in the existing order detail endpoint.
The query would have thrown at runtime. I rewrote it to fetch order items
with `variant.product` joined and aggregate by `productId` in JS using a
Map. Lesson noted: read the schema before writing the query, not after.

### Frontend — 8 files (4 new pages, 1 layout rewrite, 1 sidebar component, 1 relocation)

**`frontend/src/app/admin/layout.js`** — rewritten as sidebar layout
matching the v5.3.3 stakeholder mock:
- 240px left sidebar with darker bg (#0A0A0A vs main #0B0B0B)
- ANTIVAXXER wordmark + ADMIN CONSOLE red label
- Server component with HARD AUTH GATE preserved unchanged from v5.3.5
- Mobile (<1024px): sidebar stacks horizontally as a scrollable top bar

**`frontend/src/app/admin/AdminSidebar.js`** — new client component
(client because it uses usePathname for active highlighting and signOut
from next-auth/react). The parent layout is the server component with
the auth gate; this never renders for non-admins. Features:
- Vertical nav: Dashboard, Products, Inventory, Orders, Promos, Customers
- Red left-border active state (matches mock exactly)
- Signed-in admin email in footer
- View Store + Sign Out links

**`frontend/src/app/admin/page.js`** — NEW dashboard:
- 6 stat tiles in 3×2 grid (revenue, orders, AOV, pending, low stock,
  new customers) — Bebas Neue bone-white numbers, red accent for danger
- Top sellers list (last 30 days, ranked, with thumbnails)
- Recent orders table with status pills + click-through
- Low stock list (only renders if count > 0) + click-through to inventory
- Red banner at top if low stock count > 0

**`frontend/src/app/admin/products/page.js`** — RELOCATED from old
`/admin/page.js`, content unchanged. The old root admin page was the
products list; v5.3.6 moves it under /admin/products and replaces /admin
with the new dashboard. Existing edit page at /admin/products/[id] is
unaffected.

**`frontend/src/app/admin/inventory/page.js`** — NEW top-level inventory:
- Flattens every variant across every product into one searchable table
- Search by SKU, product name, color, size, category
- Filter tabs: All / Low / Out (with live counts)
- Color-coded stock counts (white=ok, yellow=low, red=out)
- Per-row "Edit" link to /admin/products/:id
- useMemo for performance with large variant lists

**`frontend/src/app/admin/promos/page.js`** — NEW promo CRUD:
- Table list with all promo fields, usage count, expiry, active toggle,
  delete button
- Inline create form (collapsible "+ New Code" button)
- 3 promo types: percentage, fixed_amount, free_shipping
- Form auto-disables value field when type is free_shipping
- Active toggle flips inline (PUT isActive)
- Delete button shows confirm dialog; backend refuses if usages exist
  and the UI shows the error suggesting deactivation

**`frontend/src/app/admin/customers/page.js`** — NEW customers list:
- Debounced search (300ms) on name and email
- Columns: name, email, orders, lifetime spend, joined date, "View →"
- Drill-through to /admin/customers/[id]

**`frontend/src/app/admin/customers/[id]/page.js`** — NEW customer detail:
- Profile header (name, email, member-since, role)
- Two stat cards: total orders, lifetime spend
- Full order history table with status pills, item count, total, tracking
- Drill-through to /admin/orders/:id for order management
- Back link to /admin/customers

### Visual fidelity to the v5.3.3 mock

The mock was a stakeholder design preview — none of those pages existed
in live code at the time. v5.3.6 brings the live admin in line with it:

- **Sidebar layout** — 240px wide, darker bg, ANTIVAXXER + ADMIN CONSOLE
  branding, vertical nav with red left-border active state
- **Bebas Neue throughout** — H1s, stat tile numbers, brand text
- **Stat cards** — bone-white Bebas Neue numbers, red accent for danger
- **Tables** — thin borders, hover states, status pills with colored bg
- **Color tokens** — uses the existing av-* Tailwind colors (bone, red,
  gunmetal, etc.) so it matches the rest of the site

## Files changed
- `frontend/src/app/admin/layout.js` (rewritten — sidebar layout)
- `frontend/src/app/admin/AdminSidebar.js` (new)
- `frontend/src/app/admin/page.js` (new — dashboard; old content moved)
- `frontend/src/app/admin/products/page.js` (relocated from /admin/page.js)
- `frontend/src/app/admin/inventory/page.js` (new)
- `frontend/src/app/admin/promos/page.js` (new)
- `frontend/src/app/admin/customers/page.js` (new)
- `frontend/src/app/admin/customers/[id]/page.js` (new)
- `api/src/routes/admin.js` (5 new endpoints added before module.exports)

## Rollback

```bash
# Frontend
cp _rollback/v5.3.5/app/admin/layout.js frontend/src/app/admin/layout.js
cp _rollback/v5.3.5/app/admin/page.js frontend/src/app/admin/page.js
rm frontend/src/app/admin/AdminSidebar.js
rm -rf frontend/src/app/admin/inventory
rm -rf frontend/src/app/admin/promos
rm -rf frontend/src/app/admin/customers
rm frontend/src/app/admin/products/page.js  # was relocated FROM /admin/page.js

# Backend
# The 5 new endpoints can be left in place safely (unused if frontend is
# reverted). They are tagged "[AV-050] v5.3.6" in comments so you can find
# and remove them manually if needed. They start at "// ===== DELETE
# /api/admin/promos/:id =====" through to the customer detail endpoint.
```

## Validation

- **9/9 parse checks pass** (Babel for JSX, `new Function` for CommonJS)
- **62/63 structural checks pass** (one false fail on a check that banned
  literal "lineTotal" — the only remaining occurrence is the existing
  order detail endpoint computing it in JS for the response, which is
  correct, not a Prisma query)

See `validation-report-v5.3.6.txt` in the zip for the full output.

## Deployment notes

1. **No new env vars** — uses existing `JWT_SECRET`, `NEXTAUTH_SECRET`,
   etc. from v5.3.5.
2. **No Prisma migration** — uses existing schema fields only.
3. **First admin user still required** (carried over from v5.3.5):
   ```sql
   UPDATE users SET role='admin' WHERE email='you@antivaxxer.com';
   ```
   Without this, /admin redirects to /403 for everyone.
4. **Smoke test after deploy:**
   - /admin → dashboard loads with sidebar
   - /admin/inventory → variant list with filter tabs
   - /admin/promos → list with "+ New Code" button
   - /admin/customers → list with search box
   - Click a customer → profile + orders
   - Click an order → existing /admin/orders/[id] detail page

## What's NOT in this release (Session C)

- **Order line-item editing** — admin still can't edit, add, or remove
  items on an existing order. Customer must cancel + reorder for any
  change. Needs editable item list + recalc + restock-on-removal logic.
- **Product status `coming_soon` / `prelaunch`** — currently only
  active/draft/archived. Needs schema migration + UI dropdown + frontend
  hide-buy-button handling.
- **Shippo integration** — for automated processing → shipped → delivered
  status transitions and tracking.
- **Stripe webhook → processing transition** — currently only
  pending → paid is automated.
