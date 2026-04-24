/**
 * Product API — Zod Validation Schemas
 *
 * [AV-003] feat: product catalog API with Zod validation
 *
 * Per Security Standards (Playbook Section 8):
 * All request parameters validated server-side before processing.
 * Zod schemas define expected shape, type, and constraints.
 */

const { z } = require('zod');

// Query params for GET /api/products
//
// [AV-051] v5.3.7 — added `coming_soon` and `prelaunch` to the status enum.
//   These are PUBLICLY VISIBLE statuses (just not purchasable in the same way):
//   - active     — normal product, full add-to-cart
//   - coming_soon — visible on storefront, NO buy button, "Coming Soon" badge
//   - prelaunch  — visible on storefront, "Pre-Order" CTA (still adds to cart)
//   - draft      — admin-only, hidden from storefront
//   - archived   — admin-only, hidden from storefront
//
//   The default behavior of GET /api/products is "show me what customers
//   should see on the storefront", which is now active + coming_soon + prelaunch.
//   Callers can still pass ?status=active to get only purchasable items, or
//   ?status=draft to view drafts in admin contexts.
const productListQuery = z.object({
  category: z
    .string()
    .max(50)
    .optional()
    .transform((val) => val?.toLowerCase()),
  status: z
    .enum(['active', 'draft', 'archived', 'coming_soon', 'prelaunch'])
    .optional(), // No default — route handler defaults to publicly visible array
  featured: z
    .enum(['true', 'false'])
    .optional()
    .transform((val) => (val === 'true' ? true : val === 'false' ? false : undefined)),
  sort: z
    .enum(['price_asc', 'price_desc', 'newest', 'name', 'sort_order'])
    .optional()
    .default('sort_order'),
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(50),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .default(0),
});

// URL param for GET /api/products/:slug
const productSlugParam = z.object({
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
});

module.exports = {
  productListQuery,
  productSlugParam,
};
