/**
 * Cart Routes — Abandoned Cart Recovery
 *
 * [AV-034] feat: cart recovery page
 *
 * GET /api/cart/recover/:token — Recover an abandoned cart by its unique token.
 *   Returns the saved cart items if the token is valid and not already recovered.
 *   Marks the cart as recovered so the same token can't be reused.
 *
 * POST /api/cart/save — Save cart state for abandoned cart tracking.
 *   Called when the customer enters their email at checkout.
 *   Upserts: if the same email already has an unrecovered cart, updates it.
 *
 * Error handling:
 *   - Invalid/expired/used tokens return 404 with a clear message.
 *   - The recovery endpoint is public (no auth required) because the
 *     64-char hex token is the authentication. Tokens are single-use.
 */

const express = require('express');
const router = express.Router();
const { recoverCart, saveAbandonedCart } = require('../services/abandonedCart');
const { validate } = require('../middleware/validate');
const { z } = require('zod');

// ===== GET /api/cart/recover/:token =====
router.get('/recover/:token', async (req, res, next) => {
  try {
    const { token } = req.params;

    // Token validation: must be 64-char hex (matches what crypto.randomBytes(32) produces)
    if (!token || !/^[a-f0-9]{64}$/.test(token)) {
      return res.status(404).json({
        error: { code: 'INVALID_TOKEN', message: 'This recovery link is invalid.' },
      });
    }

    const cartData = await recoverCart(token);

    if (!cartData) {
      return res.status(404).json({
        error: {
          code: 'CART_NOT_FOUND',
          message: 'This cart has already been recovered or the link has expired.',
        },
      });
    }

    // cartData is a JSON snapshot of the cart items saved at checkout
    res.json({ recovered: true, cart: cartData });
  } catch (error) {
    next(error);
  }
});

// ===== POST /api/cart/save =====
const saveCartBody = z.object({
  email: z.string().email(),
  cartData: z.any(), // JSON snapshot — validated by the frontend, stored as-is
});

router.post('/save', validate(saveCartBody, 'body'), async (req, res, next) => {
  try {
    const { email, cartData } = req.body;
    await saveAbandonedCart(email, cartData);
    res.json({ saved: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
