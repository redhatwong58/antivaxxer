/**
 * Product Routes — Public Catalog API
 *
 * [AV-003] feat: product catalog API with Zod validation
 *
 * GET /api/products          — List products (filterable by category, sortable)
 * GET /api/products/:slug    — Single product with full variant matrix
 *
 * All endpoints are public (no auth required).
 * Variant stock_qty is excluded from public responses to prevent
 * competitors from scraping inventory levels.
 */

const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { validate } = require('../middleware/validate');
const { productListQuery, productSlugParam } = require('../validators/products');

// ===== GET /api/products =====
// Returns list of active products with their variants, colors, sizes, and primary image.
// Filterable by category slug, sortable by price/name/newest.
router.get('/', validate(productListQuery, 'query'), async (req, res, next) => {
  try {
    const { category, status, featured, sort, limit, offset } = req.query;

    // [AV-051] v5.3.7 — if no status filter, return all publicly-visible products
    // (active + coming_soon + prelaunch). Admins can pass ?status=draft to view drafts.
    const PUBLIC_STATUSES = ['active', 'coming_soon', 'prelaunch'];
    const where = status
      ? { status }
      : { status: { in: PUBLIC_STATUSES } };
    if (category) {
      where.category = { slug: category };
    }
    if (featured !== undefined) {
      where.featured = featured;
    }

    // Build sort order
    const orderBy = {
      price_asc: { basePrice: 'asc' },
      price_desc: { basePrice: 'desc' },
      newest: { createdAt: 'desc' },
      name: { name: 'asc' },
      sort_order: { sortOrder: 'asc' },
    }[sort] || { sortOrder: 'asc' };

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          category: {
            select: { id: true, name: true, slug: true },
          },
          colors: {
            include: {
              color: { select: { id: true, name: true, hexCode: true } },
            },
            orderBy: { color: { sortOrder: 'asc' } },
          },
          sizes: {
            include: {
              size: { select: { id: true, name: true } },
            },
            orderBy: { size: { sortOrder: 'asc' } },
          },
          images: {
            where: { isPrimary: true },
            take: 1,
            select: { url: true, altText: true },
          },
          // Include variant count and in-stock status (without exposing exact qty)
          variants: {
            where: { isActive: true },
            select: {
              id: true,
              colorId: true,
              sizeId: true,
              sku: true,
              priceOverride: true,
              // stockQty used server-side for inStock calc, NOT sent to client
              stockQty: true,
              isActive: true,
            },
          },
        },
      }),
      prisma.product.count({ where }),
    ]);

    // Transform response: flatten junction tables for cleaner API
    const transformed = products.map((product) => ({
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: product.category,
      basePrice: Number(product.basePrice),
      comparePrice: product.comparePrice ? Number(product.comparePrice) : null,
      description: product.description,
      variantLabel: product.variantLabel,
      badge: product.badge,
      featured: product.featured,
      primaryImage: product.images[0] || null,
      colors: product.colors.map((pc) => pc.color),
      sizes: product.sizes.map((ps) => ps.size),
      variantCount: product.variants.length,
      // Flag if any variant has stock (without revealing exact numbers)
      inStock: product.variants.some((v) => v.stockQty > 0),
    }));

    res.json({
      products: transformed,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    next(error);
  }
});

// ===== GET /api/products/:slug =====
// Returns a single product with full detail: all variants, all images, all colors/sizes.
// This is the product detail / modal view endpoint.
router.get('/:slug', validate(productSlugParam, 'params'), async (req, res, next) => {
  try {
    const { slug } = req.params;

    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        category: {
          select: { id: true, name: true, slug: true },
        },
        colors: {
          include: {
            color: { select: { id: true, name: true, hexCode: true } },
          },
          orderBy: { color: { sortOrder: 'asc' } },
        },
        sizes: {
          include: {
            size: { select: { id: true, name: true, sortOrder: true } },
          },
          orderBy: { size: { sortOrder: 'asc' } },
        },
        images: {
          include: {
            color: { select: { id: true, name: true } },
          },
          orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }],
        },
        variants: {
          where: { isActive: true },
          include: {
            color: { select: { id: true, name: true, hexCode: true } },
            size: { select: { id: true, name: true } },
          },
          orderBy: [
            { color: { sortOrder: 'asc' } },
            { size: { sortOrder: 'asc' } },
          ],
        },
      },
    });

    if (!product) {
      return res.status(404).json({
        error: {
          code: 'PRODUCT_NOT_FOUND',
          message: `No product found with slug "${slug}".`,
        },
      });
    }

    // Transform: flatten junctions, build variant matrix, hide stock qty
    const transformed = {
      id: product.id,
      name: product.name,
      slug: product.slug,
      category: product.category,
      basePrice: Number(product.basePrice),
      comparePrice: product.comparePrice ? Number(product.comparePrice) : null,
      description: product.description,
      variantLabel: product.variantLabel,
      badge: product.badge,
      featured: product.featured,
      seoTitle: product.seoTitle,
      seoDesc: product.seoDesc,
      colors: product.colors.map((pc) => pc.color),
      sizes: product.sizes.map((ps) => ps.size),
      images: product.images.map((img) => ({
        url: img.url,
        altText: img.altText,
        isPrimary: img.isPrimary,
        colorId: img.colorId,
        colorName: img.color?.name || null,
      })),
      variants: product.variants.map((v) => ({
        id: v.id,
        sku: v.sku,
        color: v.color,
        size: v.size,
        price: v.priceOverride ? Number(v.priceOverride) : Number(product.basePrice),
        // Expose availability boolean, not exact stock count
        available: v.isActive,
        inStock: v.stockQty > 0,
      })),
    };

    res.json({ product: transformed });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
