/**
 * Checkout Routes — Stripe Payment Integration
 *
 * [AV-011] feat: stripe payment intent endpoint
 *
 * POST /api/checkout/create-payment-intent
 *   - Accepts cart items (variant IDs + quantities) + addresses
 *   - Looks up variant prices SERVER-SIDE (never trust client prices)
 *   - Calculates subtotal + shipping
 *   - Creates Stripe PaymentIntent
 *   - Returns client_secret for frontend to confirm payment
 *
 * Public endpoint (no auth — guests can checkout).
 * Rate limited via checkoutLimiter.
 */

const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { validate } = require('../middleware/validate');
const { createPaymentIntentBody } = require('../validators/checkout');
const { SHIPPING } = require('../../../shared/constants');
const { generateOrderNumber } = require('../utils/orderNumber');

// Initialize Stripe
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ===== POST /api/checkout/create-payment-intent =====
router.post(
  '/create-payment-intent',
  validate(createPaymentIntentBody, 'body'),
  async (req, res, next) => {
    try {
      const { email, items, shippingAddress, billingAddress, sameAsShipping } = req.body;

      // Resolve billing address
      const resolvedBilling = sameAsShipping ? shippingAddress : billingAddress;

      // Look up all variants SERVER-SIDE to get real prices
      const variantIds = items.map((item) => item.variantId);
      const variants = await prisma.variant.findMany({
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
      });

      // Validate all variants exist and are active
      const errors = [];
      const lineItems = [];

      for (const cartItem of items) {
        const variant = variants.find((v) => v.id === cartItem.variantId);

        if (!variant) {
          errors.push(`Variant ${cartItem.variantId} not found or unavailable.`);
          continue;
        }

        if (variant.product.status !== 'active') {
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

      // Shipping: flat rate or free over threshold
      const shippingAmount =
        subtotal >= SHIPPING.FREE_THRESHOLD ? 0 : SHIPPING.FLAT_RATE;

      // Tax: deferred to Phase 3 (Stripe Tax)
      const taxAmount = 0;

      const total = subtotal + shippingAmount + taxAmount;

      // Create Stripe PaymentIntent
      // Amount in cents (Stripe requires integer cents)
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(total * 100),
        currency: 'usd',
        metadata: {
          email,
          itemCount: String(lineItems.length),
        },
        receipt_email: email,
      });

      // Create pending order with line items (webhook will confirm + deduct inventory)
      const orderNumber = await generateOrderNumber();
      await prisma.order.create({
        data: {
          orderNumber,
          email,
          status: 'pending',
          subtotal,
          shippingAmount,
          shippingMethod: shippingAmount === 0 ? SHIPPING.FREE_LABEL : SHIPPING.FLAT_LABEL,
          taxAmount,
          total,
          stripePaymentIntentId: paymentIntent.id,
          shippingAddress: shippingAddress,
          billingAddress: resolvedBilling,
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

      res.json({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        totals: {
          subtotal: subtotal.toFixed(2),
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
