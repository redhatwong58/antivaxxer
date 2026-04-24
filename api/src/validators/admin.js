/**
 * Admin Validation Schemas — Zod
 *
 * [AV-009] feat: admin product editor with variant matrix and S3 upload
 *
 * Validates admin inputs for product creation and updates.
 * Per Security Standards: all input validated server-side.
 */

const { z } = require('zod');

const createProductBody = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  slug: z
    .string()
    .min(1)
    .max(255)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens'),
  categoryId: z.string().uuid('Invalid category ID'),
  basePrice: z.coerce.number().positive('Price must be positive').max(9999.99),
  comparePrice: z.coerce.number().positive().max(9999.99).nullable().optional(),
  description: z.string().max(5000).optional(),
  variantLabel: z.string().max(200).optional(),
  badge: z.enum(['BESTSELLER', 'NEW', 'HOT', 'COLLAB', '']).nullable().optional(),
  status: z.enum(['active', 'draft', 'archived', 'coming_soon', 'prelaunch']).optional().default('draft'),
  featured: z.boolean().optional().default(false),
  colorIds: z.array(z.string().uuid()).optional().default([]),
  sizeIds: z.array(z.string().uuid()).optional().default([]),
});

const updateProductBody = createProductBody.partial();

const updateVariantsBody = z.object({
  variants: z.array(
    z.object({
      id: z.string().uuid().optional(),
      colorId: z.string().uuid().nullable().optional(),
      sizeId: z.string().uuid().nullable().optional(),
      sku: z.string().min(1).max(50),
      priceOverride: z.coerce.number().positive().max(9999.99).nullable().optional(),
      stockQty: z.coerce.number().int().min(0).max(99999),
      weightOz: z.coerce.number().positive().max(999).nullable().optional(),
      isActive: z.boolean().optional().default(true),
    })
  ),
});

module.exports = {
  createProductBody,
  updateProductBody,
  updateVariantsBody,
};
