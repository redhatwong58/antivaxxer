/**
 * Account Routes — Customer-Facing Account API
 *
 * [AV-017] feat: customer order history
 *
 * GET /api/account/orders — user's orders (requires valid JWT)
 * GET /api/account/orders/:id — single order detail (must belong to user)
 *
 * Auth: Validates JWT token from NextAuth session.
 * The frontend sends the session token via Authorization header.
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');
const { JWT_SECRET } = require('../lib/jwt');

// JWT-based auth middleware for account routes
// Verifies the signed API token from /api/auth/login
async function requireUser(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({
      error: { code: 'UNAUTHORIZED', message: 'Login required.' },
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    if (!decoded.userId) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid token.' },
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'User not found.' },
      });
    }

    req.user = user;
    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({
        error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token.' },
      });
    }
    return res.status(500).json({
      error: { code: 'INTERNAL_ERROR', message: 'Authentication error.' },
    });
  }
}

router.use(requireUser);

// ===== GET /api/account/orders =====
router.get('/orders', async (req, res, next) => {
  try {
    const orders = await prisma.order.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: { select: { items: true } },
      },
    });

    res.json({
      orders: orders.map((o) => ({
        id: o.id,
        orderNumber: o.orderNumber,
        status: o.status,
        total: Number(o.total),
        itemCount: o._count.items,
        createdAt: o.createdAt,
        trackingNumber: o.trackingNumber,
        trackingUrl: o.trackingUrl,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ===== GET /api/account/orders/:id =====
router.get('/orders/:id', async (req, res, next) => {
  try {
    const order = await prisma.order.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id, // Ensures user can only see their own orders
      },
      include: { items: true },
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
        })),
      },
    });
  } catch (error) {
    next(error);
  }
});

// ============================================================
// WISHLIST — [AV-029]
// ============================================================

// ===== GET /api/account/wishlist =====
router.get('/wishlist', async (req, res, next) => {
  try {
    const items = await prisma.wishlist.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      include: {
        product: {
          select: {
            id: true, name: true, slug: true, basePrice: true, badge: true, status: true,
            category: { select: { name: true } },
            images: { where: { isPrimary: true }, take: 1, select: { url: true } },
          },
        },
      },
    });

    res.json({
      wishlist: items.map((w) => ({
        id: w.id,
        productId: w.product.id,
        name: w.product.name,
        slug: w.product.slug,
        basePrice: Number(w.product.basePrice),
        badge: w.product.badge,
        category: w.product.category?.name,
        primaryImage: w.product.images[0]?.url || null,
        addedAt: w.createdAt,
      })),
    });
  } catch (error) {
    next(error);
  }
});

// ===== POST /api/account/wishlist/:productId =====
router.post('/wishlist/:productId', async (req, res, next) => {
  try {
    const item = await prisma.wishlist.create({
      data: { userId: req.user.id, productId: req.params.productId },
    });
    res.status(201).json({ added: true, id: item.id });
  } catch (error) {
    if (error.code === 'P2002') {
      return res.json({ added: true, message: 'Already in wishlist.' });
    }
    next(error);
  }
});

// ===== DELETE /api/account/wishlist/:productId =====
router.delete('/wishlist/:productId', async (req, res, next) => {
  try {
    await prisma.wishlist.deleteMany({
      where: { userId: req.user.id, productId: req.params.productId },
    });
    res.json({ removed: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
