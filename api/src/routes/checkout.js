/**
 * Checkout Routes — Stripe Payment Integration
 *
 * [AV-011] feat: stripe payment intent endpoint
 * [AV-059] v5.4.0 — CONSUMER FLOW FIXES:
 *   1. Optional JWT auth: if customer is logged in, userId is saved on the
 *      order so it appears in /account/orders. Guest checkout still works.
 *   2. Allow 'prelaunch' product status through checkout (pre-orders).
 *   3. Promo code application: accepts promoCode in body, validates it,
 *      computes discount, saves on order.
 *
 * POST /api/checkout/create-payment-intent
 *   - Accepts cart items (variant IDs + quantities) + addresses + optional promoCode
 *   - Looks up variant prices SERVER-SIDE (never trust client prices)
 *   - Validates promo code if provided
 *   - Calculates subtotal + discount + shipping + tax
 *   - Creates Stripe PaymentIntent
 *   - Creates pending order with userId (if authenticated)
 *   - Returns client_secret + order number for confirmation page
 *
 * Public endpoint (no auth required — guests can checkout).
 * Rate limited via checkoutLimiter.
 */

const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { prisma } = require('../lib/prisma');
const { validate } = require('../middleware/validate');
const { createPaymentIntentBody } = require('../validators/checkout');
const { SHIPPING } = require('../../../shared/constants');
const { generateOrderNumber } = require('../utils/orderNumber');
const { JWT_SECRET } = require('../lib/jwt');

// [AV-061] v5.4.2 — centralized Stripe init with timeout + retry
const stripe = require('../lib/stripe');

// [AV-059] Optional user extraction — doesn't reject if no auth, just sets userId=null
// [AV-072] v5.5.3 — BUGFIX: was reading decoded.id/decoded.sub but JWT signs
// with { userId: user.id }. This caused all logged-in checkouts to create
// guest orders. Orders never appeared in /account/orders and per-user promo
// limits never enforced.
function extractOptionalUserId(req) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) return null;
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded?.userId || null;
  } catch {
    return null; // expired/invalid token — treat as guest
  }
}

// ===== POST /api/checkout/create-payment-intent =====
router.post(
  '/create-payment-intent',
  validate(createPaymentIntentBody, 'body'),
  async (req, res, next) => {
    try {
      const { email, items, shippingAddress, billingAddress, sameAsShipping, promoCode } = req.body;
      const userId = extractOptionalUserId(req);

      // Resolve billing address
      const resolvedBilling = sameAsShipping ? shippingAddress : billingAddress;

      // Look up variants and promo code in parallel — they're independent queries
      const variantIds = items.map((item) => item.variantId);
      const [variants, promoRecord] = await Promise.all([
        prisma.variant.findMany({
          where: { id: { in: variantIds }, isActive: true },
          include: {
            product: {
              select: {
                id: true,
                name: true,
                basePrice: true,
                status: true,
              },
            },
            color: { select: { id: true, name: true } },
            size: { select: { id: true, name: true } },
          },
        }),
        promoCode
          ? prisma.promoCode.findUnique({ where: { code: promoCode.toUpperCase() } })
          : Promise.resolve(null),
      ]);

      // Validate all variants exist and are active
      const errors = [];
      const lineItems = [];

      for (const cartItem of items) {
        const variant = variants.find((v) => v.id === cartItem.variantId);

        if (!variant) {
          errors.push(`Variant ${cartItem.variantId} not found or unavailable.`);
          continue;
        }

        // [AV-059] v5.4.0 — allow active AND prelaunch products through checkout.
        // coming_soon is intentionally blocked (no purchase path).
        const PURCHASABLE_STATUSES = ['active', 'prelaunch'];
        if (!PURCHASABLE_STATUSES.includes(variant.product.status)) {
          errors.push(`${variant.product.name} is no longer available.`);
          continue;
        }

        if (variant.stockQty < cartItem.quantity) {
          errors.push(
            `${variant.product.name} (${variant.sku}): only ${variant.stockQty} in stock, requested ${cartItem.quantity}.`
          );
          continue;
        }

        const unitPrice = variant.priceOverride
          ? Number(variant.priceOverride)
          : Number(variant.product.basePrice);

        lineItems.push({
          variantId: variant.id,
          productId: variant.product.id,
          productName: variant.product.name,
          colorName: variant.color?.name || null,
          sizeName: variant.size?.name || null,
          sku: variant.sku,
          quantity: cartItem.quantity,
          unitPrice,
          lineTotal: unitPrice * cartItem.quantity,
        });
      }

      if (errors.length > 0) {
        return res.status(400).json({
          error: {
            code: 'CHECKOUT_VALIDATION',
            message: 'Some items in your cart have issues.',
            details: errors,
          },
        });
      }

      // Calculate totals
      const subtotal = lineItems.reduce((sum, item) => sum + item.lineTotal, 0);

      // [AV-059] v5.4.0 — Promo code validation + discount application
      let discountAmount = 0;
      let appliedPromoCode = null;
      let freeShipping = false;

      if (promoCode && promoRecord && promoRecord.isActive) {
        const promo = promoRecord;
        const now = new Date();
        const isValid =
          (!promo.startsAt || now >= promo.startsAt) &&
          (!promo.expiresAt || now <= promo.expiresAt) &&
          (promo.maxUses === null || promo.usedCount < promo.maxUses) &&
          (!promo.minOrderAmount || subtotal >= Number(promo.minOrderAmount));

        // Per-user limit check
        let userLimitOk = true;
        if (isValid && userId && promo.maxUsesPerUser !== null) {
          const userUsages = await prisma.promoUsage.count({
            where: { promoCodeId: promo.id, userId },
          });
          if (userUsages >= promo.maxUsesPerUser) userLimitOk = false;
        }

        if (isValid && userLimitOk) {
          appliedPromoCode = promo.code;
          if (promo.type === 'percentage') {
            discountAmount = subtotal * (Number(promo.value) / 100);
          } else if (promo.type === 'fixed_amount') {
            discountAmount = Math.min(Number(promo.value), subtotal);
          } else if (promo.type === 'free_shipping') {
            freeShipping = true;
          }
        }
        // If promo is invalid, we silently ignore it and proceed without discount.
        // The frontend already validated it via /api/promos/validate — this is
        // just a server-side double-check to prevent manipulation.
      }

      // Shipping: flat rate or free over threshold (or free via promo)
      const shippingAmount =
        freeShipping || subtotal >= SHIPPING.FREE_THRESHOLD ? 0 : SHIPPING.FLAT_RATE;

      // [AV-054] v5.3.8 — Tax: Stripe Tax handles US sales tax automatically.
      //
      // IMPORTANT: This requires Stripe Tax to be activated in the dashboard
      // first (Settings → Tax → Activate Stripe Tax) AND the relevant state
      // tax registrations to be added. Without that activation, this flag
      // is a no-op and tax stays at $0. Activation is a Stripe dashboard
      // action, NOT a code deploy — see DEPLOYMENT_GUIDE.md "v5.3.8" notes.
      //
      // Stripe Tax pulls the customer's address from the PaymentIntent and
      // computes the right tax based on origin (your business location) +
      // destination (their shipping address). The taxAmount field on the
      // order will be backfilled by the webhook when payment_intent.succeeded
      // fires (Stripe attaches the calculated amount to the intent).
      const taxAmount = 0; // initial value — Stripe Tax updates this in the webhook

      const total = subtotal - discountAmount + shippingAmount + taxAmount;

      // Create Stripe PaymentIntent with automatic tax calculation
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100),
        currency: 'usd',
        automatic_tax: { enabled: true }, // [AV-054] v5.3.8
        metadata: {
          email,
          itemCount: String(lineItems.length),
          ...(appliedPromoCode ? { promoCode: appliedPromoCode } : {}),
        },
        receipt_email: email,
      });

      // Create pending order with line items (webhook will confirm + deduct inventory)
      const orderNumber = await generateOrderNumber();
      const order = await prisma.order.create({
        data: {
          orderNumber,
          email,
          status: 'pending',
          subtotal,
          discountAmount,
          promoCode: appliedPromoCode,
          shippingAmount,
          shippingMethod: shippingAmount === 0 ? SHIPPING.FREE_LABEL : SHIPPING.FLAT_LABEL,
          taxAmount,
          total,
          stripePaymentIntentId: paymentIntent.id,
          shippingAddress: shippingAddress,
          billingAddress: resolvedBilling,
          // [AV-059] v5.4.0 — link order to user if logged in
          userId: userId || undefined,
          items: {
            create: lineItems.map((item) => ({
              variantId: item.variantId,
              productName: item.productName,
              colorName: item.colorName,
              sizeName: item.sizeName,
              sku: item.sku,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
            })),
          },
        },
      });

      // [AV-059] v5.4.0 — record promo usage if promo was applied and user is logged in
      // promoRecord was already fetched in the Promise.all at the top of this handler
      if (appliedPromoCode && userId && promoRecord) {
        await prisma.promoUsage.create({
          data: {
            promoCodeId: promoRecord.id,
            userId,
            orderId: order.id,
          },
        });
        await prisma.promoCode.update({
          where: { id: promoRecord.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        orderNumber, // [AV-059] v5.4.0 — returned so confirmation page can show it
        totals: {
          subtotal: subtotal.toFixed(2),
          discount: discountAmount.toFixed(2),
          promoCode: appliedPromoCode,
          shipping: shippingAmount.toFixed(2),
          shippingLabel:
            shippingAmount === 0 ? SHIPPING.FREE_LABEL : SHIPPING.FLAT_LABEL,
          tax: taxAmount.toFixed(2),
          total: total.toFixed(2),
        },
        lineItems: lineItems.map((item) => ({
          productName: item.productName,
          colorName: item.colorName,
          sizeName: item.sizeName,
          sku: item.sku,
          quantity: item.quantity,
          unitPrice: item.unitPrice.toFixed(2),
          lineTotal: item.lineTotal.toFixed(2),
        })),
      });
    } catch (error) {
      // Stripe-specific errors
      if (error.type === 'StripeCardError') {
        return res.status(400).json({
          error: { code: 'PAYMENT_ERROR', message: error.message },
        });
      }
      if (error.type === 'StripeInvalidRequestError') {
        console.error('[STRIPE] Invalid request:', error.message);
        return res.status(500).json({
          error: {
            code: 'PAYMENT_CONFIG_ERROR',
            message: 'Payment system configuration error. Please try again later.',
          },
        });
      }
      next(error);
    }
  }
);

module.exports = router;
