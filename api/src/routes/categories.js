/**
 * Category Routes — Public Catalog API
 *
 * [AV-003] feat: product catalog API with Zod validation
 *
 * GET /api/categories — List active categories with product counts
 *
 * Public endpoint, no auth required.
 */

const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');

// ===== GET /api/categories =====
// Returns all active categories sorted by sort_order, with product count per category.
router.get('/', async (req, res, next) => {
  try {
    const categories = await prisma.category.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        _count: {
          select: {
            products: {
              where: { status: 'active' },
            },
          },
        },
      },
    });

    const transformed = categories.map((cat) => ({
      id: cat.id,
      name: cat.name,
      slug: cat.slug,
      productCount: cat._count.products,
    }));

    res.json({ categories: transformed });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
