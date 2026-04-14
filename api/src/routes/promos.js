/**
 * Promo Routes — Code Validation + Admin CRUD
 *
 * [AV-020] feat: promo code engine
 *
 * Public:
 *   POST /api/promos/validate — Validate a promo code and return discount
 *
 * Admin (via admin routes):
 *   GET  /api/admin/promos      — List all promo codes
 *   POST /api/admin/promos      — Create promo code
 *   PUT  /api/admin/promos/:id  — Update promo code
 */

const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');

// ===== POST /api/promos/validate =====
// Public endpoint — validates a code and returns the discount type/value.
// Does NOT apply the discount — that happens in checkout.
router.post('/validate', async (req, res, next) => {
  try {
    const { code, subtotal, userId } = req.body;

    if (!code) {
      return res.status(400).json({
        error: { code: 'MISSING_CODE', message: 'Promo code is required.' },
      });
    }

    const promo = await prisma.promoCode.findUnique({
      where: { code: code.toUpperCase() },
    });

    if (!promo || !promo.isActive) {
      return res.status(404).json({
        error: { code: 'INVALID_CODE', message: 'This promo code is not valid.' },
      });
    }

    // Check date range
    const now = new Date();
    if (promo.startsAt && now < promo.startsAt) {
      return res.status(400).json({
        error: { code: 'NOT_YET_ACTIVE', message: 'This promo code is not yet active.' },
      });
    }
    if (promo.expiresAt && now > promo.expiresAt) {
      return res.status(400).json({
        error: { code: 'EXPIRED', message: 'This promo code has expired.' },
      });
    }

    // Check total usage limit
    if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
      return res.status(400).json({
        error: { code: 'MAX_USES', message: 'This promo code has reached its usage limit.' },
      });
    }

    // Check per-user limit (only if user is logged in)
    if (userId && promo.maxUsesPerUser !== null) {
      const userUsages = await prisma.promoUsage.count({
        where: { promoCodeId: promo.id, userId },
      });
      if (userUsages >= promo.maxUsesPerUser) {
        return res.status(400).json({
          error: { code: 'USER_LIMIT', message: 'You have already used this promo code.' },
        });
      }
    }

    // Check minimum order amount
    if (promo.minOrderAmount && subtotal && parseFloat(subtotal) < Number(promo.minOrderAmount)) {
      return res.status(400).json({
        error: {
          code: 'MIN_ORDER',
          message: `Minimum order of $${Number(promo.minOrderAmount).toFixed(2)} required.`,
        },
      });
    }

    // Calculate discount preview
    let discountAmount = 0;
    if (subtotal) {
      const sub = parseFloat(subtotal);
      if (promo.type === 'percentage') {
        discountAmount = sub * (Number(promo.value) / 100);
      } else if (promo.type === 'fixed_amount') {
        discountAmount = Math.min(Number(promo.value), sub);
      }
      // free_shipping: discount is $0, but shipping becomes free
    }

    res.json({
      valid: true,
      promo: {
        code: promo.code,
        type: promo.type,
        value: Number(promo.value),
        discountAmount: discountAmount.toFixed(2),
        freeShipping: promo.type === 'free_shipping',
      },
    });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
