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
// [AV-056] v5.3.8 — Stripe SDK for the refund endpoint
// [AV-061] v5.4.2 — centralized Stripe init with timeout + retry
const stripe = require('../lib/stripe');

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

    // [AV-060] v5.4.1 — send shipping notification when manually set to shipped
    if (status === 'shipped') {
      try {
        const { sendShippingNotification } = require('../services/email');
        await sendShippingNotification(order);
      } catch (emailErr) {
        console.error('[ADMIN] Shipping notification email failed (non-fatal):', emailErr.message);
      }
    }

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

// ===== PUT /api/admin/orders/:id/items =====
// [AV-053] v5.3.7 — admin order line-item editing.
//
// Allows admins to add, remove, or change quantities on line items of an
// existing order. All stock adjustments and total recalculations happen in
// a single Prisma transaction so the order is never left in an inconsistent
// state. An audit note is appended to order.notes with a timestamp + diff.
//
// Body shape (full replacement model — admin sends the desired final list):
// {
//   items: [
//     { variantId: "uuid", quantity: 2 },        // existing or new
//     { variantId: "uuid", quantity: 1 },
//     ...
//   ]
// }
//
// The endpoint computes the diff against current items:
//   - Existing item not in new list  → REMOVED, restock variant
//   - New item not in current list   → ADDED, decrement stock (reject if insufficient)
//   - Quantity changed               → adjust stock by delta
//
// Refuses to edit orders in shipped/delivered/cancelled/refunded states —
// at that point the items are physically out the door and editing them
// causes accounting and audit problems. Allowed for: pending, paid, processing.
//
// Note: the existing OrderItem unitPrice is preserved (we don't reprice on
// admin edit — the customer paid that price). Only added items get the
// current variant price. Tax and shipping are NOT recalculated by this
// endpoint — admin must adjust those separately if needed via a refund or
// new charge. This is intentional: re-tax-calculating retroactively is a
// legal/accounting minefield.
router.put('/orders/:id/items', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { items: newItems } = req.body;

    if (!Array.isArray(newItems) || newItems.length === 0) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'items must be a non-empty array' },
      });
    }
    for (const item of newItems) {
      if (!item.variantId || typeof item.quantity !== 'number' || item.quantity < 1) {
        return res.status(400).json({
          error: {
            code: 'VALIDATION_ERROR',
            message: 'Each item needs a variantId and quantity >= 1',
          },
        });
      }
    }

    // Fetch order with current items + variants
    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        items: { include: { variant: true } },
      },
    });

    if (!order) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    const EDITABLE = ['pending', 'paid', 'processing'];
    if (!EDITABLE.includes(order.status)) {
      return res.status(409).json({
        error: {
          code: 'NOT_EDITABLE',
          message: `Cannot edit items on a ${order.status} order. Editable statuses: ${EDITABLE.join(', ')}`,
        },
      });
    }

    // Build the diff
    const currentByVariant = new Map();
    for (const item of order.items) {
      currentByVariant.set(item.variantId, item);
    }
    const newByVariant = new Map();
    for (const item of newItems) {
      // If admin sends the same variantId twice, sum the quantities (prevents bugs)
      const existing = newByVariant.get(item.variantId) || 0;
      newByVariant.set(item.variantId, existing + item.quantity);
    }

    // Validate added/changed items have enough stock
    // (we do this BEFORE any DB writes so we can reject cleanly)
    const variantIds = Array.from(new Set([
      ...currentByVariant.keys(),
      ...newByVariant.keys(),
    ]));
    const variants = await prisma.variant.findMany({
      where: { id: { in: variantIds } },
      include: {
        product: { select: { id: true, name: true, basePrice: true } },
        color: { select: { name: true } },
        size: { select: { name: true } },
      },
    });
    const variantMap = new Map(variants.map((v) => [v.id, v]));

    // Stock check: for each new/changed item, check that the variant has
    // enough stock to cover the increase (decrease is always fine)
    for (const [variantId, newQty] of newByVariant) {
      const variant = variantMap.get(variantId);
      if (!variant) {
        return res.status(400).json({
          error: {
            code: 'VARIANT_NOT_FOUND',
            message: `Variant ${variantId} does not exist`,
          },
        });
      }
      const currentItem = currentByVariant.get(variantId);
      const currentQty = currentItem?.quantity || 0;
      const delta = newQty - currentQty; // positive = need more stock
      if (delta > 0 && variant.stockQty < delta) {
        return res.status(409).json({
          error: {
            code: 'INSUFFICIENT_STOCK',
            message: `${variant.product.name} (${variant.sku}) — need ${delta} more, only ${variant.stockQty} in stock`,
            sku: variant.sku,
            available: variant.stockQty,
            requested: delta,
          },
        });
      }
    }

    // Compute the diff for the audit note
    const auditDiff = [];
    for (const item of order.items) {
      if (!newByVariant.has(item.variantId)) {
        auditDiff.push(`REMOVED ${item.quantity}× ${item.sku}`);
      }
    }
    for (const [variantId, newQty] of newByVariant) {
      const currentItem = currentByVariant.get(variantId);
      const variant = variantMap.get(variantId);
      const sku = variant?.sku || variantId;
      if (!currentItem) {
        auditDiff.push(`ADDED ${newQty}× ${sku}`);
      } else if (currentItem.quantity !== newQty) {
        auditDiff.push(`CHANGED ${sku}: ${currentItem.quantity} → ${newQty}`);
      }
    }
    if (auditDiff.length === 0) {
      return res.status(400).json({
        error: { code: 'NO_CHANGES', message: 'Submitted items match existing order — nothing to change' },
      });
    }

    // === TRANSACTION: stock adjustments + item updates + total recalc + audit ===
    const result = await prisma.$transaction(async (tx) => {
      // 1. Restock removed items
      for (const item of order.items) {
        if (!newByVariant.has(item.variantId)) {
          await tx.variant.update({
            where: { id: item.variantId },
            data: { stockQty: { increment: item.quantity } },
          });
          await tx.orderItem.delete({ where: { id: item.id } });
        }
      }

      // 2. Update changed items + adjust stock
      for (const item of order.items) {
        if (!newByVariant.has(item.variantId)) continue;
        const newQty = newByVariant.get(item.variantId);
        if (newQty === item.quantity) continue;
        const delta = newQty - item.quantity; // positive = decrement stock, negative = restock
        await tx.variant.update({
          where: { id: item.variantId },
          data: { stockQty: { decrement: delta } },
        });
        await tx.orderItem.update({
          where: { id: item.id },
          data: { quantity: newQty },
        });
      }

      // 3. Add new items + decrement stock
      for (const [variantId, newQty] of newByVariant) {
        if (currentByVariant.has(variantId)) continue;
        const variant = variantMap.get(variantId);
        await tx.variant.update({
          where: { id: variantId },
          data: { stockQty: { decrement: newQty } },
        });
        await tx.orderItem.create({
          data: {
            orderId: order.id,
            variantId: variant.id,
            productName: variant.product.name,
            colorName: variant.color?.name || null,
            sizeName: variant.size?.name || null,
            sku: variant.sku,
            quantity: newQty,
            unitPrice: variant.product.basePrice, // current price for new items
          },
        });
      }

      // 4. Recalculate subtotal from the now-updated items
      const updatedItems = await tx.orderItem.findMany({ where: { orderId: order.id } });
      const newSubtotal = updatedItems.reduce(
        (sum, item) => sum + Number(item.unitPrice) * item.quantity,
        0
      );
      // Total = subtotal - discount + shipping + tax
      // (we keep the existing discount/shipping/tax as-is; admin can adjust separately)
      const newTotal =
        newSubtotal -
        Number(order.discountAmount) +
        Number(order.shippingAmount) +
        Number(order.taxAmount);

      // 5. Append audit note
      const timestamp = new Date().toISOString();
      const adminLabel = req.adminUser?.email || req.adminUser?.id || 'admin';
      const auditLine = `[${timestamp}] ${adminLabel} edited items: ${auditDiff.join('; ')}. Subtotal ${Number(order.subtotal).toFixed(2)} → ${newSubtotal.toFixed(2)}, total ${Number(order.total).toFixed(2)} → ${newTotal.toFixed(2)}`;
      const newNotes = order.notes ? `${order.notes}\n${auditLine}` : auditLine;

      // 6. Update the order
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          subtotal: newSubtotal,
          total: newTotal,
          notes: newNotes,
        },
      });

      return { updatedOrder, auditLine };
    });

    res.json({
      success: true,
      diff: auditDiff,
      auditLine: result.auditLine,
      order: {
        id: result.updatedOrder.id,
        subtotal: Number(result.updatedOrder.subtotal),
        total: Number(result.updatedOrder.total),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===== POST /api/admin/orders/:id/refund =====
// [AV-056] v5.3.8 — admin order refund.
//
// Issues a Stripe refund (partial or full), restocks the inventory if it
// was a full refund, sets the order status to "refunded", and appends an
// audit note. Refuses to refund if the order has no Stripe payment intent
// or if it's already in a refunded state.
//
// Body:
//   { amount?: number, reason?: string }
//   - amount: defaults to full order total (in dollars). Pass a smaller
//     number for partial refund. Stripe handles partial refund accounting.
//   - reason: optional admin note ("customer request", "damaged in transit", etc.)
//     Stored in the audit trail and passed to Stripe as metadata.
//
// IMPORTANT: stock is restocked ONLY for full refunds. Partial refunds
// don't restock — the assumption is the customer is keeping the items
// but getting some money back (price adjustment, damaged box, etc.).
// If you need a partial refund WITH partial item return, use the line
// item editing endpoint (PUT /items) FIRST to remove the returned items,
// then refund the difference.
router.post('/orders/:id/refund', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { amount, reason } = req.body || {};

    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: true },
    });
    if (!order) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }
    if (!order.stripePaymentIntentId) {
      return res.status(400).json({
        error: {
          code: 'NO_PAYMENT_INTENT',
          message: 'Order has no Stripe payment to refund (was it created via test/manual flow?)',
        },
      });
    }
    if (order.status === 'refunded') {
      return res.status(409).json({
        error: { code: 'ALREADY_REFUNDED', message: 'This order is already marked refunded' },
      });
    }

    const orderTotal = Number(order.total);
    const refundAmount = amount != null ? Number(amount) : orderTotal;

    if (refundAmount <= 0 || refundAmount > orderTotal) {
      return res.status(400).json({
        error: {
          code: 'INVALID_AMOUNT',
          message: `Refund amount must be between 0 and the order total ($${orderTotal.toFixed(2)})`,
        },
      });
    }

    const isFullRefund = Math.abs(refundAmount - orderTotal) < 0.01;

    // === STRIPE REFUND ===
    let stripeRefund;
    try {
      stripeRefund = await stripe.refunds.create({
        payment_intent: order.stripePaymentIntentId,
        amount: Math.round(refundAmount * 100), // Stripe uses cents
        reason: 'requested_by_customer', // Stripe enum; admin's free-text reason goes in metadata
        metadata: {
          orderNumber: order.orderNumber,
          adminNote: (reason || '').slice(0, 200),
          adminEmail: req.adminUser?.email || 'unknown',
        },
      });
    } catch (stripeErr) {
      console.error('[REFUND] Stripe refund failed for', order.orderNumber, '—', stripeErr.message);
      return res.status(502).json({
        error: {
          code: 'STRIPE_ERROR',
          message: stripeErr.message || 'Stripe refund failed',
          stripeCode: stripeErr.code,
        },
      });
    }

    // === DB UPDATES (transaction) ===
    const result = await prisma.$transaction(async (tx) => {
      // Restock items for full refunds only
      if (isFullRefund) {
        for (const item of order.items) {
          await tx.variant.update({
            where: { id: item.variantId },
            data: { stockQty: { increment: item.quantity } },
          });
        }
      }

      // Audit note
      const timestamp = new Date().toISOString();
      const adminLabel = req.adminUser?.email || req.adminUser?.id || 'admin';
      const auditLine = `[${timestamp}] ${adminLabel} refunded $${refundAmount.toFixed(2)}${isFullRefund ? ' (full, items restocked)' : ' (partial)'} via Stripe ${stripeRefund.id}${reason ? '. Reason: ' + reason : ''}`;
      const newNotes = order.notes ? `${order.notes}\n${auditLine}` : auditLine;

      // Status: full refunds → "refunded", partial refunds → keep current status
      // (partial refunds don't change order state; admin can manually set to refunded if they want)
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          status: isFullRefund ? 'refunded' : order.status,
          notes: newNotes,
        },
      });

      return { updatedOrder, auditLine };
    });

    res.json({
      success: true,
      refund: {
        stripeRefundId: stripeRefund.id,
        amount: refundAmount,
        isFullRefund,
        status: stripeRefund.status,
      },
      order: {
        id: result.updatedOrder.id,
        status: result.updatedOrder.status,
      },
      auditLine: result.auditLine,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// SHIPPO SHIPPING — [AV-058] v5.4.0
// ============================================================
// Two-step flow: create shipment (get rates) → purchase label (get tracking).
// Requires SHIPPO_API_KEY and the sender address env vars.

const { createShipment, purchaseLabel } = require('../services/shippo');

// ===== POST /api/admin/orders/:id/shipment =====
// Creates a Shippo shipment from the order's shipping address and returns
// available rates (sorted by price). Admin selects a rate, then calls
// /label to purchase.
router.post('/orders/:id/shipment', async (req, res, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: req.params.id },
      include: {
        items: {
          include: {
            variant: { select: { weightOz: true } },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    if (!['processing', 'paid'].includes(order.status)) {
      return res.status(409).json({
        error: {
          code: 'WRONG_STATUS',
          message: `Can only create shipments for processing/paid orders (current: ${order.status})`,
        },
      });
    }

    if (!order.shippingAddress) {
      return res.status(400).json({
        error: { code: 'NO_ADDRESS', message: 'Order has no shipping address' },
      });
    }

    // Compute total weight from variant weights, default 16oz if unknown
    const totalWeightOz = order.items.reduce((sum, item) => {
      const variantWeight = item.variant?.weightOz ? Number(item.variant.weightOz) : 8;
      return sum + variantWeight * item.quantity;
    }, 0);

    const result = await createShipment(order, totalWeightOz);

    // Save the shipment ID on the order so we can reference it for label purchase
    await prisma.order.update({
      where: { id: order.id },
      data: { shippoShipmentId: result.shipmentId },
    });

    res.json({
      shipmentId: result.shipmentId,
      rates: result.rates,
      totalWeightOz: Math.round(totalWeightOz),
    });
  } catch (error) {
    if (error.message?.includes('SHIPPO_API_KEY')) {
      return res.status(503).json({
        error: { code: 'SHIPPO_NOT_CONFIGURED', message: error.message },
      });
    }
    next(error);
  }
});

// ===== POST /api/admin/orders/:id/label =====
// Purchases a shipping label for the selected rate. Updates the order
// with tracking number, label URL, carrier info, and transitions status
// to "shipped". Also sets shippedAt timestamp.
//
// Body: { rateId: "rate_xxx" }
router.post('/orders/:id/label', async (req, res, next) => {
  try {
    const { rateId } = req.body;
    if (!rateId) {
      return res.status(400).json({
        error: { code: 'VALIDATION_ERROR', message: 'rateId is required' },
      });
    }

    const order = await prisma.order.findUnique({ where: { id: req.params.id } });
    if (!order) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Order not found' } });
    }

    if (order.labelUrl) {
      return res.status(409).json({
        error: {
          code: 'ALREADY_LABELED',
          message: 'A label has already been purchased for this order',
          labelUrl: order.labelUrl,
        },
      });
    }

    const label = await purchaseLabel(rateId);

    // Update order with all Shippo data + transition to shipped
    const adminLabel = req.adminUser?.email || req.adminUser?.id || 'admin';
    const timestamp = new Date().toISOString();
    const auditLine = `[${timestamp}] ${adminLabel} purchased shipping label via Shippo. Carrier: ${label.carrier} ${label.service}. Tracking: ${label.trackingNumber}`;
    const newNotes = order.notes ? `${order.notes}\n${auditLine}` : auditLine;

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'shipped',
        trackingNumber: label.trackingNumber,
        trackingUrl: label.trackingUrl,
        labelUrl: label.labelUrl,
        carrier: label.carrier,
        carrierService: label.serviceToken || label.service,
        shippoTransactionId: label.transactionId,
        shippedAt: new Date(),
        notes: newNotes,
      },
    });

    res.json({
      success: true,
      label: {
        transactionId: label.transactionId,
        trackingNumber: label.trackingNumber,
        trackingUrl: label.trackingUrl,
        labelUrl: label.labelUrl,
        carrier: label.carrier,
        service: label.service,
      },
      order: {
        id: updatedOrder.id,
        status: updatedOrder.status,
        shippedAt: updatedOrder.shippedAt,
      },
    });

    // [AV-060] v5.4.1 — send shipping notification email to customer
    try {
      const { sendShippingNotification } = require('../services/email');
      await sendShippingNotification(updatedOrder);
    } catch (emailErr) {
      console.error('[ADMIN] Shipping notification email failed (non-fatal):', emailErr.message);
    }
  } catch (error) {
    if (error.message?.includes('SHIPPO_API_KEY')) {
      return res.status(503).json({
        error: { code: 'SHIPPO_NOT_CONFIGURED', message: error.message },
      });
    }
    if (error.message?.includes('Shippo')) {
      return res.status(502).json({
        error: { code: 'SHIPPO_ERROR', message: error.message },
      });
    }
    next(error);
  }
});

// ============================================================
// FAILED WEBHOOK DLQ — [AV-057] v5.3.9
// ============================================================
// Endpoints for the admin dead-letter queue recovery UI.
// GET /failed-webhooks — list unresolved
// POST /failed-webhooks/:id/retry — replay the event through the handler
// POST /failed-webhooks/:id/resolve — mark resolved without retrying

// ===== GET /api/admin/failed-webhooks =====
router.get('/failed-webhooks', async (req, res, next) => {
  try {
    const showResolved = req.query.resolved === 'true';
    const where = showResolved ? {} : { resolved: false };

    const items = await prisma.failedWebhook.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 200,
    });

    res.json({
      items: items.map((i) => ({
        id: i.id,
        source: i.source,
        eventType: i.eventType,
        eventId: i.eventId,
        errorMessage: i.errorMessage,
        retryCount: i.retryCount,
        resolved: i.resolved,
        resolvedBy: i.resolvedBy,
        createdAt: i.createdAt,
        resolvedAt: i.resolvedAt,
        // Don't include full payload in list view — too big
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ===== GET /api/admin/failed-webhooks/:id =====
// Returns full payload for a single failed webhook
router.get('/failed-webhooks/:id', async (req, res, next) => {
  try {
    const item = await prisma.failedWebhook.findUnique({
      where: { id: req.params.id },
    });
    if (!item) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Failed webhook not found' } });
    }
    res.json({ item });
  } catch (error) {
    next(error);
  }
});

// ===== POST /api/admin/failed-webhooks/:id/retry =====
// Replay the original event through the normal handler. If it succeeds,
// mark the DLQ entry resolved. If it fails again, increment retry count
// and update error message but keep it in the DLQ.
router.post('/failed-webhooks/:id/retry', async (req, res, next) => {
  try {
    const dlqItem = await prisma.failedWebhook.findUnique({
      where: { id: req.params.id },
    });
    if (!dlqItem) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Failed webhook not found' } });
    }
    if (dlqItem.resolved) {
      return res.status(409).json({ error: { code: 'ALREADY_RESOLVED', message: 'Already resolved' } });
    }

    // Replay the event. We inline this logic rather than recursively calling
    // the webhook endpoint because we already have the parsed event.
    let retryError = null;
    try {
      if (dlqItem.source !== 'stripe') {
        throw new Error(`Don't know how to replay source: ${dlqItem.source}`);
      }
      const event = dlqItem.payload; // full Stripe event was stored
      if (event.type === 'payment_intent.succeeded') {
        // Call the handler directly. Import at runtime to avoid circular deps.
        const webhookModule = require('./webhooks');
        if (webhookModule.handlePaymentSuccess) {
          await webhookModule.handlePaymentSuccess(event.data.object);
        } else {
          // Fallback: we didn't export the handler from webhooks.js
          // In that case the admin should re-trigger via Stripe dashboard instead
          throw new Error('handlePaymentSuccess not exported. Trigger manually from Stripe dashboard.');
        }
      } else {
        throw new Error(`No retry logic for event type: ${event.type}`);
      }
    } catch (err) {
      retryError = err.message;
    }

    if (retryError) {
      // Retry failed — bump count and update error
      await prisma.failedWebhook.update({
        where: { id: dlqItem.id },
        data: {
          retryCount: dlqItem.retryCount + 1,
          errorMessage: retryError,
        },
      });
      return res.status(502).json({
        error: { code: 'RETRY_FAILED', message: retryError },
        retryCount: dlqItem.retryCount + 1,
      });
    }

    // Retry succeeded — mark resolved
    const adminLabel = req.adminUser?.email || req.adminUser?.id || 'admin';
    await prisma.failedWebhook.update({
      where: { id: dlqItem.id },
      data: {
        resolved: true,
        resolvedBy: adminLabel,
        resolvedAt: new Date(),
      },
    });

    res.json({ success: true, message: 'Retry succeeded. DLQ entry marked resolved.' });
  } catch (error) {
    next(error);
  }
});

// ===== POST /api/admin/failed-webhooks/:id/resolve =====
// Mark resolved WITHOUT retrying (e.g. if admin fixed it manually outside the app)
router.post('/failed-webhooks/:id/resolve', async (req, res, next) => {
  try {
    const adminLabel = req.adminUser?.email || req.adminUser?.id || 'admin';
    await prisma.failedWebhook.update({
      where: { id: req.params.id },
      data: {
        resolved: true,
        resolvedBy: adminLabel,
        resolvedAt: new Date(),
      },
    });
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Failed webhook not found' } });
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

// ===== DELETE /api/admin/promos/:id =====
// [AV-050] v5.3.6 — added so the admin Promos UI can delete codes
// (previously only PUT isActive=false was possible)
router.delete('/promos/:id', async (req, res, next) => {
  try {
    // Soft-check: if there are usages, refuse to hard-delete and ask for deactivation instead
    const usageCount = await prisma.promoUsage.count({ where: { promoCodeId: req.params.id } });
    if (usageCount > 0) {
      return res.status(409).json({
        error: {
          code: 'IN_USE',
          message: `Promo code has ${usageCount} usage record${usageCount > 1 ? 's' : ''}. Deactivate instead of deleting to preserve order history.`,
        },
      });
    }
    await prisma.promoCode.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Promo code not found.' } });
    }
    next(error);
  }
});

// ============================================================
// DASHBOARD — [AV-050] v5.3.6
// ============================================================

// ===== GET /api/admin/dashboard =====
// One-shot dashboard payload: stats + top sellers + recent orders + low stock list.
// Cheap to compute; called once on /admin landing.
router.get('/dashboard', async (req, res, next) => {
  try {
    const days = Math.min(parseInt(req.query.days) || 7, 90);
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const sinceMonth = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // Run all queries in parallel
    const [
      paidOrders,
      pendingFulfillment,
      newCustomers,
      lowStockVariants,
      recentOrders,
      topSellersRaw,
    ] = await Promise.all([
      // Revenue and order count for the period — only "paid" or later statuses count as revenue
      prisma.order.findMany({
        where: {
          status: { in: ['paid', 'processing', 'shipped', 'delivered'] },
          createdAt: { gte: since },
        },
        select: { total: true },
      }),

      // Pending fulfillment count (paid but not shipped)
      prisma.order.count({
        where: { status: { in: ['paid', 'processing'] } },
      }),

      // New customer count for the period
      prisma.user.count({
        where: { role: 'customer', createdAt: { gte: since } },
      }),

      // Low stock variants — pre-filtered at DB level by global warning threshold,
      // then refined in JS by each variant's individual lowStockThreshold
      prisma.variant.findMany({
        where: {
          isActive: true,
          stockQty: { lte: parseInt(process.env.INVENTORY_WARNING_THRESHOLD) || 15 },
        },
        include: {
          product: { select: { id: true, name: true, slug: true } },
          color: { select: { name: true } },
          size: { select: { name: true } },
        },
      }),

      // Recent orders for the dashboard list
      prisma.order.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          orderNumber: true,
          email: true,
          status: true,
          total: true,
          createdAt: true,
        },
      }),

      // Top sellers — fetch order items from last 30 days for paid orders.
      // OrderItem has variantId (not productId) and unitPrice (no precomputed
      // lineTotal), so we aggregate in JS after walking variant → product.
      prisma.orderItem.findMany({
        where: {
          order: {
            status: { in: ['paid', 'processing', 'shipped', 'delivered'] },
            createdAt: { gte: sinceMonth },
          },
        },
        select: {
          quantity: true,
          unitPrice: true,
          variant: {
            select: {
              product: {
                select: {
                  id: true,
                  name: true,
                  slug: true,
                  images: { where: { isPrimary: true }, take: 1, select: { url: true } },
                },
              },
            },
          },
        },
      }),
    ]);

    // Compute stats
    const revenue = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);
    const orderCount = paidOrders.length;
    const aov = orderCount > 0 ? revenue / orderCount : 0;

    // Filter low stock
    const lowStock = lowStockVariants
      .filter((v) => v.stockQty <= v.lowStockThreshold)
      .map((v) => ({
        variantId: v.id,
        sku: v.sku,
        productId: v.product.id,
        productName: v.product.name,
        productSlug: v.product.slug,
        color: v.color?.name || null,
        size: v.size?.name || null,
        stockQty: v.stockQty,
        threshold: v.lowStockThreshold,
        outOfStock: v.stockQty === 0,
      }));

    // Aggregate top sellers in JS by productId
    const sellerMap = new Map();
    for (const item of topSellersRaw) {
      const product = item.variant?.product;
      if (!product) continue;
      const existing = sellerMap.get(product.id) || {
        productId: product.id,
        name: product.name,
        slug: product.slug,
        thumbnail: product.images?.[0]?.url || null,
        unitsSold: 0,
        revenue: 0,
      };
      existing.unitsSold += item.quantity;
      existing.revenue += item.quantity * Number(item.unitPrice);
      sellerMap.set(product.id, existing);
    }
    const topSellers = Array.from(sellerMap.values())
      .sort((a, b) => b.unitsSold - a.unitsSold)
      .slice(0, 5);

    res.json({
      period: { days, since: since.toISOString() },
      stats: {
        revenue,
        orderCount,
        aov,
        pendingFulfillment,
        lowStockCount: lowStock.length,
        newCustomers,
      },
      recentOrders: recentOrders.map((o) => ({
        ...o,
        total: Number(o.total),
      })),
      lowStock: lowStock.slice(0, 10),
      topSellers,
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// CUSTOMERS — [AV-050] v5.3.6
// ============================================================

// ===== GET /api/admin/customers =====
// Paginated customer list with aggregated order count and lifetime spend.
router.get('/customers', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 50, 200);
    const offset = parseInt(req.query.offset) || 0;
    const search = (req.query.search || '').trim().toLowerCase();

    const where = { role: 'customer' };
    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    // Aggregate order data per user (only counts paid+ orders)
    const userIds = users.map((u) => u.id);
    const orderAggs = userIds.length
      ? await prisma.order.groupBy({
          by: ['userId'],
          where: {
            userId: { in: userIds },
            status: { in: ['paid', 'processing', 'shipped', 'delivered'] },
          },
          _count: { _all: true },
          _sum: { total: true },
        })
      : [];

    const aggByUser = Object.fromEntries(
      orderAggs.map((a) => [a.userId, { orders: a._count._all, spent: Number(a._sum.total || 0) }])
    );

    res.json({
      customers: users.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        joined: u.createdAt,
        orderCount: aggByUser[u.id]?.orders || 0,
        lifetimeSpend: aggByUser[u.id]?.spent || 0,
      })),
      pagination: { total, limit, offset },
    });
  } catch (error) {
    next(error);
  }
});

// ===== GET /api/admin/customers/:id =====
// Customer profile + full order history.
router.get('/customers/:id', async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
      },
    });
    if (!user) {
      return res.status(404).json({ error: { code: 'NOT_FOUND', message: 'Customer not found.' } });
    }

    const orders = await prisma.order.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { items: true } },
      },
    });

    const paidOrders = orders.filter((o) =>
      ['paid', 'processing', 'shipped', 'delivered'].includes(o.status)
    );
    const lifetimeSpend = paidOrders.reduce((sum, o) => sum + Number(o.total), 0);

    res.json({
      customer: {
        ...user,
        joined: user.createdAt,
        orderCount: paidOrders.length,
        lifetimeSpend,
      },
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: Number(o.total),
        itemCount: o._count.items,
        createdAt: o.createdAt,
        trackingNumber: o.trackingNumber,
      })),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
