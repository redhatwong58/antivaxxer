/**
 * Search Routes — Product Full-Text Search
 *
 * [AV-028] feat: product search
 *
 * GET /api/search?q=logo&limit=20
 *   - Searches product name, description, category name
 *   - PostgreSQL ILIKE (case-insensitive)
 *   - Upgrade path: pg_trgm for fuzzy matching later
 */

const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { validate } = require('../middleware/validate');
const { z } = require('zod');

const searchQuery = z.object({
  q: z.string().min(1, 'Search query is required').max(200),
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

router.get('/', validate(searchQuery, 'query'), async (req, res, next) => {
  try {
    const { q, limit } = req.query;

    const products = await prisma.product.findMany({
      where: {
        status: 'active',
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { description: { contains: q, mode: 'insensitive' } },
          { category: { name: { contains: q, mode: 'insensitive' } } },
        ],
      },
      take: limit,
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        basePrice: true,
        badge: true,
        category: { select: { name: true, slug: true } },
        images: {
          where: { isPrimary: true },
          take: 1,
          select: { url: true },
        },
      },
    });

    res.json({
      query: q,
      resultCount: products.length,
      products: products.map((p) => ({
        id: p.id,
        name: p.name,
        slug: p.slug,
        basePrice: Number(p.basePrice),
        badge: p.badge,
        category: p.category?.name,
        categorySlug: p.category?.slug,
        primaryImage: p.images[0]?.url || null,
      })),
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
