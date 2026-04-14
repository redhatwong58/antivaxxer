/**
 * Admin Routes — Protected Product Management API
 *
 * [AV-008] feat: admin product list with temp auth gate
 *
 * All routes require admin auth (NextAuth JWT with admin role check,
 * legacy ADMIN_TOKEN as fallback).
 *
 * GET /api/admin/products — Full product list with stock quantities
 *
 * Unlike the public API, admin endpoints expose:
 * - stock_qty per variant
 * - draft/archived products
 * - low stock alerts
 */

const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { validate } = require('../middleware/validate');
const { createProductBody, updateProductBody, updateVariantsBody } = require('../validators/admin');
const { ORDER_STATUSES } = require('../../../shared/constants');
const multer = require('multer');
const { uploadProductImage, deleteProductImage } = require('../services/imageUpload');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    cb(null, allowed.includes(file.mimetype));
  },
});

// ===== GET /api/admin/products =====
// Returns all products (including draft/archived) with full variant stock data.
router.get('/products', async (req, res, next) => {
  try {
    const { status, category, lowStock } = req.query;

    const where = {};
    if (status) where.status = status;
    if (category) where.category = { slug: category };

    const products = await prisma.product.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        variants: {
          select: {
            id: true,
            sku: true,
            stockQty: true,
            lowStockThreshold: true,
            isActive: true,
            color: { select: { id: true, name: true } },
            size: { select: { id: true, name: true } },
          },
          orderBy: [
            { color: { sortOrder: 'asc' } },
            { size: { sortOrder: 'asc' } },
          ],
        },
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true },
        },
      },
    });

    // Compute stock summaries
    const transformed = products.map((product) => {
      const totalStock = product.variants.reduce((sum, v) => sum + v.stockQty, 0);
      const lowStockVariants = product.variants.filter(
        (v) => v.stockQty <= v.lowStockThreshold && v.stockQty > 0
      );
      const outOfStockVariants = product.variants.filter((v) => v.stockQty === 0);

      return {
        id: product.id,
        name: product.name,
        slug: product.slug,
        category: product.category,
        basePrice: Number(product.basePrice),
        badge: product.badge,
        status: product.status,
        primaryImage: product.images[0]?.url || null,
        variantCount: product.variants.length,
        totalStock,
        lowStockCount: lowStockVariants.length,
        outOfStockCount: outOfStockVariants.length,
        variants: product.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          color: v.color?.name || null,
          size: v.size?.name || null,
          stockQty: v.stockQty,
          lowStock: v.stockQty <= v.lowStockThreshold && v.stockQty > 0,
          outOfStock: v.stockQty === 0,
          isActive: v.isActive,
        })),
      };
    });

    // Optional: filter to only products with low stock variants
    const result = lowStock === 'true'
      ? transformed.filter((p) => p.lowStockCount > 0 || p.outOfStockCount > 0)
      : transformed;

    res.json({
      products: result,
      summary: {
        total: result.length,
        active: result.filter((p) => p.status === 'active').length,
        draft: result.filter((p) => p.status === 'draft').length,
        archived: result.filter((p) => p.status === 'archived').length,
        lowStockProducts: result.filter((p) => p.lowStockCount > 0).length,
        outOfStockProducts: result.filter((p) => p.outOfStockCount > 0).length,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===== GET /api/admin/products/:id =====
// Single product with full detail for the editor form.
router.get('/products/:id', async (req, res, next) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id },
      include: {
        category: true,
        colors: { include: { color: true }, orderBy: { color: { sortOrder: 'asc' } } },
        sizes: { include: { size: true }, orderBy: { size: { sortOrder: 'asc' } } },
        variants: {
          include: {
            color: { select: { id: true, name: true } },
            size: { select: { id: true, name: true } },
          },
          orderBy: [{ color: { sortOrder: 'asc' } }, { size: { sortOrder: 'asc' } }],
        },
        images: { orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }] },
      },
    });

    if (!product) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Product not found.' },
      });
    }

    // Also fetch all colors and sizes for the form dropdowns
    const [allColors, allSizes, allCategories] = await Promise.all([
      prisma.color.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.size.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    ]);

    res.json({
      product: {
        ...product,
        basePrice: Number(product.basePrice),
        comparePrice: product.comparePrice ? Number(product.comparePrice) : null,
        colors: product.colors.map((pc) => pc.color),
        sizes: product.sizes.map((ps) => ps.size),
        variants: product.variants.map((v) => ({
          ...v,
          priceOverride: v.priceOverride ? Number(v.priceOverride) : null,
          weightOz: v.weightOz ? Number(v.weightOz) : null,
        })),
      },
      options: { colors: allColors, sizes: allSizes, categories: allCategories },
    });
  } catch (error) {
    next(error);
  }
});

// ===== POST /api/admin/products =====
// Create a new product with color/size associations.
// Variants are created separately via PUT /products/:id/variants.
router.post('/products', validate(createProductBody, 'body'), async (req, res, next) => {
  try {
    const { colorIds, sizeIds, ...productData } = req.body;

    const product = await prisma.product.create({
      data: {
        ...productData,
        colors: {
          create: colorIds.map((colorId) => ({ colorId })),
        },
        sizes: {
          create: sizeIds.map((sizeId) => ({ sizeId })),
        },
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        colors: { include: { color: true } },
        sizes: { include: { size: true } },
      },
    });

    res.status(201).json({
      product: {
        ...product,
        basePrice: Number(product.basePrice),
        colors: product.colors.map((pc) => pc.color),
        sizes: product.sizes.map((ps) => ps.size),
      },
    });
  } catch (error) {
    // Handle unique constraint violation (duplicate slug)
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: { code: 'DUPLICATE', message: 'A product with this slug already exists.' },
      });
    }
    next(error);
  }
});

// ===== PUT /api/admin/products/:id =====
// Update product fields. Color/size associations are replaced entirely.
router.put('/products/:id', validate(updateProductBody, 'body'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { colorIds, sizeIds, ...productData } = req.body;

    // Build update data
    const updateData = { ...productData };

    // If colorIds provided, replace all color associations
    if (colorIds) {
      await prisma.productColor.deleteMany({ where: { productId: id } });
      updateData.colors = {
        create: colorIds.map((colorId) => ({ colorId })),
      };
    }

    // If sizeIds provided, replace all size associations
    if (sizeIds) {
      await prisma.productSize.deleteMany({ where: { productId: id } });
      updateData.sizes = {
        create: sizeIds.map((sizeId) => ({ sizeId })),
      };
    }

    const product = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        colors: { include: { color: true } },
        sizes: { include: { size: true } },
      },
    });

    res.json({
      product: {
        ...product,
        basePrice: Number(product.basePrice),
        colors: product.colors.map((pc) => pc.color),
        sizes: product.sizes.map((ps) => ps.size),
      },
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Product not found.' },
      });
    }
    if (error.code === 'P2002') {
      return res.status(409).json({
        error: { code: 'DUPLICATE', message: 'A product with this slug already exists.' },
      });
    }
    next(error);
  }
});

// ===== PUT /api/admin/products/:id/variants =====
// Bulk upsert variants for a product. Creates new variants, updates existing ones.
router.put(
  '/products/:id/variants',
  validate(updateVariantsBody, 'body'),
  async (req, res, next) => {
    try {
      const { id: productId } = req.params;
      const { variants } = req.body;

      // Verify product exists
      const product = await prisma.product.findUnique({ where: { id: productId } });
      if (!product) {
        return res.status(404).json({
          error: { code: 'NOT_FOUND', message: 'Product not found.' },
        });
      }

      const results = [];

      for (const variant of variants) {
        const { id, ...data } = variant;

        if (id) {
          // Update existing variant
          const updated = await prisma.variant.update({
            where: { id },
            data: { ...data, productId },
            include: {
              color: { select: { id: true, name: true } },
              size: { select: { id: true, name: true } },
            },
          });
          results.push(updated);
        } else {
          // Create new variant
          const created = await prisma.variant.create({
            data: { ...data, productId },
            include: {
              color: { select: { id: true, name: true } },
              size: { select: { id: true, name: true } },
            },
          });
          results.push(created);
        }
      }

      res.json({ variants: results });
    } catch (error) {
      if (error.code === 'P2002') {
        return res.status(409).json({
          error: {
            code: 'DUPLICATE',
            message: 'Duplicate SKU or variant combination detected.',
          },
        });
      }
      next(error);
    }
  }
);

// ===== GET /api/admin/options =====
// Returns all colors, sizes, and categories for form dropdowns.
router.get('/options', async (req, res, next) => {
  try {
    const [colors, sizes, categories] = await Promise.all([
      prisma.color.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.size.findMany({ orderBy: { sortOrder: 'asc' } }),
      prisma.category.findMany({ where: { isActive: true }, orderBy: { sortOrder: 'asc' } }),
    ]);
    res.json({ colors, sizes, categories });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// ORDER MANAGEMENT — [AV-015]
// ============================================================

// ===== GET /api/admin/orders =====
// List orders with filters: status, date range.
router.get('/orders', async (req, res, next) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;

    const where = {};
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: parseInt(offset),
        take: parseInt(limit),
        include: {
          _count: { select: { items: true } },
        },
      }),
      prisma.order.count({ where }),
    ]);

    const transformed = orders.map((order) => ({
      id: order.id,
      orderNumber: order.orderNumber,
      email: order.email,
      status: order.status,
      total: Number(order.total),
      itemCount: order._count.items,
      createdAt: order.createdAt,
      trackingNumber: order.trackingNumber,
    }));

    res.json({
      orders: transformed,
      pagination: { total, limit: parseInt(limit), offset: parseInt(offset) },
    });
  } catch (error) {
    next(error);
  }
});

// ===== GET /api/admin/orders/:id =====
// Single order with full detail.
router.get('/orders/:id', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            variant: {
              select: { id: true, stockQty: true },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Order not found.' },
      });
    }

    res.json({
      order: {
        ...order,
        subtotal: Number(order.subtotal),
        discountAmount: Number(order.discountAmount),
        shippingAmount: Number(order.shippingAmount),
        taxAmount: Number(order.taxAmount),
        total: Number(order.total),
        items: order.items.map((item) => ({
          ...item,
          unitPrice: Number(item.unitPrice),
          lineTotal: Number(item.unitPrice) * item.quantity,
          currentStock: item.variant?.stockQty ?? null,
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===== PUT /api/admin/orders/:id/status =====
// Update order status + optional tracking info.
router.put('/orders/:id/status', async (req, res, next) => {
  try {
    const { status, trackingNumber, trackingUrl, notes } = req.body;
    const { id } = req.params;

    const validStatuses = Object.values(ORDER_STATUSES);
    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: {
          code: 'VALIDATION_ERROR',
          message: `Invalid status. Must be one of: ${validStatuses.join(', ')}`,
        },
      });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (trackingNumber !== undefined) updateData.trackingNumber = trackingNumber;
    if (trackingUrl !== undefined) updateData.trackingUrl = trackingUrl;
    if (notes !== undefined) updateData.notes = notes;
    if (status === 'shipped') updateData.shippedAt = new Date();
    if (status === 'delivered') updateData.deliveredAt = new Date();

    const order = await prisma.order.update({
      where: { id },
      data: updateData,
    });

    res.json({
      order: {
        id: order.id,
        orderNumber: order.orderNumber,
        status: order.status,
        trackingNumber: order.trackingNumber,
        shippedAt: order.shippedAt,
      },
    });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: { code: 'NOT_FOUND', message: 'Order not found.' },
      });
    }
    next(error);
  }
});

// ============================================================
// IMAGE MANAGEMENT — [AV-022]
// ============================================================

// ===== POST /api/admin/products/:id/images =====
router.post('/products/:id/images', upload.single('image'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: { code: 'NO_FILE', message: 'No image file provided.' },
      });
    }

    const { id: productId } = req.params;
    const colorId = req.body.colorId || null;

    // Verify product exists
    const product = await prisma.product.findUnique({ where: { id: productId } });
    if (!product) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Product not found.' } });
    }

    const result = await uploadProductImage(req.file.buffer, req.file.originalname, productId);

    // Check if this is the first image (make it primary)
    const existingCount = await prisma.productImage.count({ where: { productId } });

    const image = await prisma.productImage.create({
      data: {
        productId,
        colorId,
        url: result.primaryUrl,
        altText: product.name,
        isPrimary: existingCount === 0,
        sortOrder: existingCount,
      },
    });

    res.status(201).json({ image });
  } catch (error) {
    next(error);
  }
});

// ===== DELETE /api/admin/products/:id/images/:imageId =====
router.delete('/products/:id/images/:imageId', async (req, res, next) => {
  try {
    const image = await prisma.productImage.findUnique({ where: { id: req.params.imageId } });
    if (!image || image.productId !== req.params.id) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Image not found.' } });
    }

    await deleteProductImage(req.params.id, image.url);
    await prisma.productImage.delete({ where: { id: req.params.imageId } });

    // If deleted image was primary, make the next one primary
    if (image.isPrimary) {
      const next = await prisma.productImage.findFirst({
        where: { productId: req.params.id },
        orderBy: { sortOrder: 'asc' },
      });
      if (next) {
        await prisma.productImage.update({ where: { id: next.id }, data: { isPrimary: true } });
      }
    }

    res.json({ deleted: true });
  } catch (error) {
    next(error);
  }
});

// ===== PUT /api/admin/products/:id/images/reorder =====
router.put('/products/:id/images/reorder', async (req, res, next) => {
  try {
    const { imageIds } = req.body; // Array of image IDs in desired order
    if (!Array.isArray(imageIds)) {
      return res.status(400).json({ error: { code: 'VALIDATION_ERROR', message: 'imageIds array required.' } });
    }

    for (let i = 0; i < imageIds.length; i++) {
      await prisma.productImage.update({
        where: { id: imageIds[i] },
        data: { sortOrder: i, isPrimary: i === 0 },
      });
    }

    res.json({ reordered: true });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// PROMO ADMIN — [AV-020]
// ============================================================

// ===== GET /api/admin/promos =====
router.get('/promos', async (req, res, next) => {
  try {
    const promos = await prisma.promoCode.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { usages: true } } },
    });
    res.json({
      promos: promos.map((p) => ({
        ...p,
        value: Number(p.value),
        minOrderAmount: p.minOrderAmount ? Number(p.minOrderAmount) : null,
        totalUsages: p._count.usages,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ===== POST /api/admin/promos =====
router.post('/promos', async (req, res, next) => {
  try {
    const { code, type, value, minOrderAmount, maxUses, maxUsesPerUser, startsAt, expiresAt } = req.body;
    const promo = await prisma.promoCode.create({
      data: {
        code: code.toUpperCase(),
        type,
        value,
        minOrderAmount: minOrderAmount || null,
        maxUses: maxUses || null,
        maxUsesPerUser: maxUsesPerUser || null,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
      },
    });
    res.status(201).json({ promo });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.status(409).json({ error: { code: 'DUPLICATE', message: 'Promo code already exists.' } });
    }
    next(error);
  }
});

// ===== PUT /api/admin/promos/:id =====
router.put('/promos/:id', async (req, res, next) => {
  try {
    const { code, type, value, minOrderAmount, maxUses, maxUsesPerUser, startsAt, expiresAt, isActive } = req.body;
    const data = {};
    if (code !== undefined) data.code = code.toUpperCase();
    if (type !== undefined) data.type = type;
    if (value !== undefined) data.value = value;
    if (minOrderAmount !== undefined) data.minOrderAmount = minOrderAmount || null;
    if (maxUses !== undefined) data.maxUses = maxUses || null;
    if (maxUsesPerUser !== undefined) data.maxUsesPerUser = maxUsesPerUser || null;
    if (startsAt !== undefined) data.startsAt = startsAt ? new Date(startsAt) : null;
    if (expiresAt !== undefined) data.expiresAt = expiresAt ? new Date(expiresAt) : null;
    if (isActive !== undefined) data.isActive = isActive;

    const promo = await prisma.promoCode.update({
      where: { id: req.params.id },
      data,
    });
    res.json({ promo });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Promo code not found.' } });
    }
    next(error);
  }
});

// ========================================================================
// [AV-038] CRON ENDPOINTS — Triggered by external scheduler
// ========================================================================
// These endpoints are behind adminAuth (Bearer token required).
// External scheduler hits them on a schedule. Examples:
//   crontab: */15 * * * * curl -X POST -H "Authorization: Bearer $TOKEN" \
//            https://api.antivaxxer.com/api/admin/cron/abandoned-carts
//   AWS EventBridge → Lambda → HTTP POST
//   Railway/Render: built-in cron job feature
//
// To rollback: delete this section.
// ========================================================================

const { processAbandonedCarts, cleanupAbandonedCarts } = require('../services/abandonedCart');

// POST /api/admin/cron/abandoned-carts
// Finds abandoned carts past the recovery delay and sends recovery emails.
// Idempotent — safe to call repeatedly. Returns count processed.
router.post('/cron/abandoned-carts', async (req, res, next) => {
  try {
    const result = await processAbandonedCarts();
    console.log(`[CRON] Abandoned cart processor: ${result} email(s) sent`);
    res.json({ success: true, processed: result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[CRON] Abandoned cart processor failed:', error.message);
    next(error);
  }
});

// POST /api/admin/cron/cleanup
// Deletes recovered or expired abandoned carts older than 7 days.
// Run daily. Returns count deleted.
router.post('/cron/cleanup', async (req, res, next) => {
  try {
    const result = await cleanupAbandonedCarts();
    console.log(`[CRON] Cleanup: ${result} cart(s) deleted`);
    res.json({ success: true, deleted: result, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('[CRON] Cleanup failed:', error.message);
    next(error);
  }
});

module.exports = router;
