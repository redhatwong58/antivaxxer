# ANTIVAXXER — Developer Guide
## Everything Not in the README

The README covers installation, scripts, and project structure. This guide covers how things actually work, how to do common tasks, and how to avoid breaking things.

---

## 1. Setting Up PostgreSQL (First Time)

The site needs PostgreSQL to store products. Here's how to set it up on each platform.

### Mac
```bash
# Install via Homebrew
brew install postgresql@15

# Start the service
brew services start postgresql@15

# Create the database
createdb antivaxxer_dev

# Verify it works
psql antivaxxer_dev -c "SELECT 1;"
```

Your DATABASE_URL will be:
```
DATABASE_URL=postgresql://your_mac_username@localhost:5432/antivaxxer_dev
```

To find your Mac username: `whoami`

No password is needed for local Mac PostgreSQL by default. If you set one:
```
DATABASE_URL=postgresql://your_mac_username:your_password@localhost:5432/antivaxxer_dev
```

### Windows
1. Download installer from https://www.postgresql.org/download/windows/
2. Run installer — remember the password you set for the `postgres` user
3. Open pgAdmin (installed with PostgreSQL) or use the SQL Shell (psql)
4. Create a database:
```sql
CREATE DATABASE antivaxxer_dev;
```

Your DATABASE_URL will be:
```
DATABASE_URL=postgresql://postgres:your_password@localhost:5432/antivaxxer_dev
```

### Docker (Any Platform)
```bash
docker run -d \
  --name antivaxxer-db \
  -e POSTGRES_PASSWORD=devpassword \
  -e POSTGRES_DB=antivaxxer_dev \
  -p 5432:5432 \
  postgres:15

# Your DATABASE_URL:
# DATABASE_URL=postgresql://postgres:devpassword@localhost:5432/antivaxxer_dev
```

To stop: `docker stop antivaxxer-db`
To restart: `docker start antivaxxer-db`
To delete entirely: `docker rm -f antivaxxer-db`

---

## 2. Running Migrations and Seeding Data

After setting DATABASE_URL in your `.env` file:

```bash
cd api

# Generate the Prisma client (translates schema into code)
npx prisma generate

# Run migrations (creates the 8 database tables)
npx prisma migrate dev --name initial_schema

# Seed the database (loads 16 products with 114 variant SKUs)
npm run db:seed

# Open Prisma Studio to see your data in a browser GUI
npm run db:studio
```

Prisma Studio opens at `http://localhost:5555`. You can browse every table, see relationships, and edit data directly.

### If Something Goes Wrong with the Database

```bash
# Reset everything — drops all tables, re-runs migrations, re-seeds
cd api
npx prisma migrate reset

# This is destructive — all data is deleted. Only use in development.
```

### If You Change the Schema

```bash
cd api

# 1. Edit prisma/schema.prisma
# 2. Generate a new migration
npx prisma migrate dev --name describe_what_changed

# 3. Regenerate the Prisma client
npx prisma generate
```

Never edit migration files after they've been created. If a migration is wrong, create a new one that fixes it.

---

## 3. How the Two Servers Connect

The project runs two servers simultaneously:

```
Browser → Next.js (port 3000) → Express API (port 4000) → PostgreSQL
```

**Next.js** serves the website pages (HTML, CSS, React components).
**Express** serves the data API (product catalog, admin CRUD).

They connect through a proxy configured in `frontend/next.config.js`:

```javascript
// When the frontend calls /api/products, Next.js forwards it to Express
async rewrites() {
  return [{ source: '/api/:path*', destination: 'http://localhost:4000/api/:path*' }];
}
```

This means frontend code can call `/api/products` without worrying about ports or CORS. In production, you'd point this at your real API domain.

---

## 4. How the Admin System Works

### Logging In

1. Go to `http://localhost:3000/admin`
2. Enter the ADMIN_TOKEN value from your `.env` file
3. The token is stored in your browser's sessionStorage (cleared when you close the tab)

This is a temporary system. Phase 3 replaces it with NextAuth.js user accounts with admin roles.

### Viewing Products

The admin product list shows all products (including drafts and archived) with:
- Total stock across all variants
- Stock health indicators (green = OK, yellow = low stock, red = out of stock)
- Status badges (active, draft, archived)

Filter by status or check "Low stock only" to find products needing restocking.

### Editing a Product

Click any row in the product list to open the editor. You can change:
- Name, slug, category, prices, description, badge, status
- Which colors and sizes are available (toggle buttons)
- Stock quantity per variant (inline in the variant matrix table)
- Price overrides per variant (leave blank to use base price)
- Active/inactive toggle per variant

Click **Save** to update. The editor sends to the API which validates with Zod and updates the database.

### Creating a New Product

Click **+ Add Product** in the admin list. Fill in the form. The slug auto-generates from the name. Select colors and sizes. After saving, the editor redirects to the edit page where you can manage variants.

Note: Variants are auto-generated by the seed script based on color × size combinations. For new products created via admin, you'll need to create variants via the API or Prisma Studio until the variant auto-generation is added to the editor.

---

## 5. How the Cart Works

Cart state lives in React Context (`CartContext.js`) and persists to `localStorage` under the key `antivaxxer_cart`.

### Flow

1. User clicks a product card → ProductModal opens
2. User selects size and color → component finds matching variant
3. User clicks "Add to Cart" → `addItem()` adds to context state
4. Context saves to localStorage on every change
5. Toast notification confirms the add
6. Cart drawer opens showing the item

### Cart Data Shape

Each cart item looks like:
```javascript
{
  variantId: "uuid-of-the-variant",
  productId: "uuid-of-the-product",
  name: "Classic Logo Tee — Black",
  color: "Black",
  size: "L",
  price: 35.00,
  image: null,  // Will be a URL once product images are uploaded
  sku: "AV-TEE-BLK-L",
  qty: 1
}
```

### Limits

- Maximum 99 of any single variant (enforced in `addItem` and `updateQty`)
- Minimum quantity is 1 (use the remove button to delete, not decrement to 0)
- Cart survives page refresh (localStorage) but clears when browser data is cleared

### Where Checkout Picks Up

The "Checkout" button in the cart drawer currently does nothing. Phase 2 wires it to Stripe. The cart data is ready — Stripe needs the variant IDs, quantities, and prices to create a PaymentIntent.

---

## 6. How to Swap the Logo

The logo is currently rendered as text ("ANTIVAXXER" in Bebas Neue font). To use an image:

1. Place your logo file in `frontend/public/images/` (e.g., `logo.png`)
2. Open `frontend/src/components/layout/Header.js`
3. Find the logo section (the `<span>` with "ANTIVAXXER")
4. Replace with:

```jsx
import Image from 'next/image';

// Replace the <span> with:
<Image src="/images/logo.png" alt="ANTIVAXXER" height={36} width={180} />
```

5. Do the same in `Footer.js` if you want the image logo there too.

Same filename, no code change needed if you use `logo.png`. Different filename, one line change per component.

---

## 7. How to Add the US Map

The Resources page embeds an interactive map via iframe from `frontend/public/us-map.html`. A placeholder file is included.

To add your real map:

1. Take one of the map files from the earlier build session:
   - `us-map-edgy-final-v2.html` (Edgy Badass theme — matches brand)
   - `us-map-smart-final-v2.html` (Smart Casual theme)
   - `us-map-treasure-final-v2.html` (Treasure Map theme)

2. Rename it to `us-map.html`

3. Replace `frontend/public/us-map.html` with it

4. Refresh the Resources page — the real map loads immediately

No code changes needed. The iframe source stays the same.

---

## 8. How the API is Organized

### Public Endpoints (no auth)

| Method | Path | What It Does |
|--------|------|-------------|
| GET | /api/health | Server health check |
| GET | /api/products | List products (filterable, sortable, paginated) |
| GET | /api/products/:slug | Single product with full variant matrix |
| GET | /api/categories | List categories with product counts |

### Admin Endpoints (require Bearer token)

| Method | Path | What It Does |
|--------|------|-------------|
| GET | /api/admin/products | All products with stock data |
| GET | /api/admin/products/:id | Single product for editor form |
| POST | /api/admin/products | Create new product |
| PUT | /api/admin/products/:id | Update product |
| PUT | /api/admin/products/:id/variants | Bulk update variants |
| GET | /api/admin/options | All colors, sizes, categories for dropdowns |

### How Auth Works on Admin Endpoints

Every request to `/api/admin/*` must include:
```
Authorization: Bearer your-admin-token-here
```

The middleware in `api/src/middleware/adminAuth.js` checks this against the `ADMIN_TOKEN` environment variable. If it doesn't match, the request is rejected before reaching the route handler.

### How Validation Works

Every endpoint that accepts input uses Zod schemas defined in `api/src/validators/`. The `validate` middleware in `api/src/middleware/validate.js` runs the schema against `req.query`, `req.params`, or `req.body` before the route handler executes.

If validation fails, the client gets a 400 response with specific field-level errors:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid request parameters.",
    "details": [
      { "field": "slug", "message": "Slug must be lowercase letters, numbers, and hyphens" }
    ]
  }
}
```

The route handler never runs with bad data.

---

## 9. How to Add a New API Endpoint

Example: adding a search endpoint.

### Step 1: Create the Zod validator (if the endpoint accepts input)

```javascript
// api/src/validators/search.js
const { z } = require('zod');

const searchQuery = z.object({
  q: z.string().min(1).max(200),
  limit: z.coerce.number().int().min(1).max(50).optional().default(10),
});

module.exports = { searchQuery };
```

### Step 2: Create the route file

```javascript
// api/src/routes/search.js
const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { validate } = require('../middleware/validate');
const { searchQuery } = require('../validators/search');

router.get('/', validate(searchQuery, 'query'), async (req, res, next) => {
  try {
    const { q, limit } = req.query;
    // Your query logic here
    const results = await prisma.product.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      take: limit,
    });
    res.json({ results });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
```

### Step 3: Wire it into the server

```javascript
// api/src/index.js — add this line with the other routes
app.use('/api/search', require('./routes/search'));
```

### Step 4: Test it

```bash
curl http://localhost:4000/api/search?q=tee
curl http://localhost:4000/api/search?q=&limit=5  # should fail validation
```

---

## 10. How to Add a New Frontend Page

Example: adding a Contact page.

### Step 1: Create the page file

```javascript
// frontend/src/app/contact/page.js
export const metadata = {
  title: 'Contact',
  description: 'Get in touch with ANTIVAXXER.',
};

export default function ContactPage() {
  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-24 text-center">
        <h1 className="font-heading text-5xl tracking-widest text-av-bone mb-6">
          CONTACT
        </h1>
        {/* Your content here */}
      </div>
    </div>
  );
}
```

That's it. Next.js automatically creates the route `/contact` from the folder name. No router configuration needed.

### Step 2: Add it to navigation (optional)

In `frontend/src/components/layout/Header.js`, add to the `navLinks` array:
```javascript
const navLinks = [
  { href: '/', label: 'Shop' },
  { href: '/about', label: 'About' },
  { href: '/faq', label: 'FAQ' },
  { href: '/resources', label: 'Resources' },
  { href: '/contact', label: 'Contact' },  // new
];
```

Same in `Footer.js` if you want it there.

---

## 11. Understanding the Product Data Model

```
Category (tees, hoodie, collab, etc.)
  └── Product (Classic Logo Tee)
        ├── has many Colors (Black, Pepper, Blue Jean)
        ├── has many Sizes (S, M, L, XL, 2XL, 3XL)
        ├── has many Variants (one per color × size combo)
        │     └── Variant = the actual purchasable SKU
        │           ├── SKU: AV-TEE-BLK-L
        │           ├── stock_qty: 50
        │           ├── price_override: null (uses product base_price)
        │           └── weight_oz: 10.0
        └── has many Images (per product, optionally per color)
```

**Why variants exist separately from products:**
A "Classic Logo Tee" is one product. But "Classic Logo Tee in Black, size Large" is a specific thing someone buys. That's a variant. It has its own SKU, its own stock count, and can have its own price. When someone adds to cart, they add a variant — not a product.

**The junction tables:**
`product_colors` and `product_sizes` define which colors and sizes a product OFFERS. `variants` defines the actual purchasable combinations. A product might offer Black and Pepper in S through 3XL, creating 12 variants (2 colors × 6 sizes).

---

## 12. File-by-File Reference

### API Files

| File | Purpose |
|------|---------|
| `api/src/index.js` | Express server entry point, middleware setup, route wiring |
| `api/src/lib/prisma.js` | Prisma client singleton (prevents connection pool exhaustion) |
| `api/src/middleware/adminAuth.js` | Temporary admin token check (Phase 3: NextAuth) |
| `api/src/middleware/errorHandler.js` | Global error handler — structured responses, no internals exposed |
| `api/src/middleware/rateLimiter.js` | 5 rate limit tiers (login, register, checkout, admin, general) |
| `api/src/middleware/validate.js` | Zod validation middleware — reusable for query, params, body |
| `api/src/routes/products.js` | Public product catalog endpoints |
| `api/src/routes/categories.js` | Public category list endpoint |
| `api/src/routes/admin.js` | Admin CRUD endpoints (list, get, create, update, variants, options) |
| `api/src/validators/products.js` | Zod schemas for public product endpoints |
| `api/src/validators/admin.js` | Zod schemas for admin product CRUD |
| `api/prisma/schema.prisma` | Database schema — all 8 tables |
| `api/prisma/seed.js` | Seeds 16 products with 114 variants |
| `api/prisma/migrations/` | SQL migration files (auto-generated by Prisma) |

### Frontend Files

| File | Purpose |
|------|---------|
| `frontend/src/app/layout.js` | Root layout — Header, Footer, CartProvider, ToastProvider |
| `frontend/src/app/page.js` | Home page — hero section + product grid |
| `frontend/src/app/shop/page.js` | Shop page — product grid with filters |
| `frontend/src/app/about/page.js` | About page — brand story |
| `frontend/src/app/faq/page.js` | FAQ page — 9 questions with accordion |
| `frontend/src/app/resources/page.js` | Resources page — national orgs + US Map embed |
| `frontend/src/app/admin/layout.js` | Admin layout — separate header with "Admin" badge |
| `frontend/src/app/admin/page.js` | Admin product list — table with stock data |
| `frontend/src/app/admin/products/[id]/page.js` | Admin product editor — form with variant matrix |
| `frontend/src/components/layout/Header.js` | Sticky nav, mobile menu, cart icon |
| `frontend/src/components/layout/Footer.js` | 3-column footer with social links |
| `frontend/src/components/product/ProductGrid.js` | Fetches products from API, renders cards |
| `frontend/src/components/product/ProductCard.js` | Individual product tile |
| `frontend/src/components/product/CategoryFilter.js` | Category filter tab bar |
| `frontend/src/components/product/ProductModal.js` | Product detail modal with size/color selectors |
| `frontend/src/components/cart/CartContext.js` | Cart state management + localStorage persistence |
| `frontend/src/components/cart/CartDrawer.js` | Slide-out cart panel |
| `frontend/src/components/ui/Toast.js` | Notification system (success, error, warning) |
| `frontend/src/components/ui/Skeleton.js` | Loading placeholder components |
| `frontend/src/lib/api.js` | API client utility (get, post, put, delete) |
| `frontend/src/styles/globals.css` | Tailwind entry, base styles, animations |

### Config Files

| File | Purpose |
|------|---------|
| `package.json` (root) | Monorepo workspace config, shared scripts |
| `frontend/package.json` | Next.js + Tailwind dependencies |
| `api/package.json` | Express + Prisma + Zod + bcrypt dependencies |
| `shared/package.json` | Shared workspace config |
| `shared/constants/index.js` | Categories, sizes, statuses shared between frontend and API |
| `.env.example` | All environment variables with phase documentation |
| `.gitignore` | Files excluded from Git |
| `.prettierrc` | Code formatting rules |
| `frontend/tailwind.config.js` | Brand color tokens, fonts, plugins |
| `frontend/next.config.js` | API proxy, image domains |
| `frontend/jsconfig.json` | Path alias (@/ maps to src/) |
| `frontend/postcss.config.js` | PostCSS + Tailwind pipeline |
| `api/.eslintrc.json` | API linting rules |

---

## 13. Common Tasks Quick Reference

### Check if the API is running
```bash
curl http://localhost:4000/api/health
# Should return: {"status":"ok","timestamp":"..."}
```

### See all products in the database
```bash
cd api && npm run db:studio
# Opens browser GUI at localhost:5555
```

### Reset the database to initial state
```bash
cd api
npx prisma migrate reset
# Drops everything, re-runs migrations, re-runs seed
```

### Add a new product via API (using curl)
```bash
curl -X POST http://localhost:4000/api/admin/products \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -d '{
    "name": "New Product",
    "slug": "new-product",
    "categoryId": "CATEGORY_UUID_FROM_DB",
    "basePrice": 45.00,
    "status": "draft"
  }'
```

### Check for code formatting issues
```bash
npm run format:check
```

### Fix formatting
```bash
npm run format
```

### Check for lint errors
```bash
npm run lint
```

---

## 14. What Each Phase Adds

### Phase 1 (Current — Complete)
Foundation, product catalog, cart, admin. Everything runs locally.

### Phase 2 (Next)
Stripe payments, checkout flow, order creation, inventory deduction, confirmation emails via AWS SES. After Phase 2, real customers can buy products.

### Phase 3
User accounts (NextAuth.js), order history, saved addresses, cart sync between devices, shipping rates (Shippo), tax calculation (Stripe Tax), promo code validation, Cloudflare Turnstile bot protection.

### Phase 4
Per-variant product images (S3 upload), SEO meta tags + structured data, Terms/Privacy/Return policy pages, mobile QA, security hardening, staging environment.

### Phase 5
Analytics (GA4), wishlist, product search, marketing emails (Mailchimp), abandoned cart recovery, accessibility audit.
