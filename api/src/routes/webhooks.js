/**
 * Webhook Routes — Stripe Event Processing
 *
 * [AV-013] feat: stripe webhook, order creation, inventory deduction
 *
 * POST /api/webhooks/stripe
 *   - Verifies stripe-signature header (security)
 *   - payment_intent.succeeded → create order, deduct inventory
 *   - payment_intent.payment_failed → log failure
 *   - Idempotent: skips if order already exists for this PaymentIntent
 *
 * IMPORTANT: This route uses express.raw() for body parsing because
 * Stripe signature verification requires the raw request body.
 * It is mounted BEFORE the global express.json() middleware.
 */

const express = require('express');
const router = express.Router();
const { prisma } = require('../lib/prisma');
const { sendOrderConfirmation } = require('../services/email');
// [AV-033] Inventory alerts — fire-and-forget after inventory deduction
const { checkInventoryLevels } = require('../services/inventoryAlerts');

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

// ===== POST /api/webhooks/stripe =====
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET not configured.');
      return res.status(500).send('Webhook not configured.');
    }

    let event;

    // Verify signature
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('[WEBHOOK] Signature verification failed:', err.message);
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Process event
    try {
      switch (event.type) {
        case 'payment_intent.succeeded':
          await handlePaymentSuccess(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await handlePaymentFailed(event.data.object);
          break;

        default:
          // Unhandled event type — acknowledge but don't process
          console.log(`[WEBHOOK] Unhandled event type: ${event.type}`);
      }
    } catch (err) {
      // Log error but return 200 — Stripe will retry on non-200
      // and we don't want infinite retries for processing errors
      console.error(`[WEBHOOK] Error processing ${event.type}:`, err.message);
    }

    // Always return 200 to acknowledge receipt
    res.json({ received: true });
  }
);

// ===== PAYMENT SUCCESS HANDLER =====
async function handlePaymentSuccess(paymentIntent) {
  const piId = paymentIntent.id;

  // Find the pending order created during checkout
  const order = await prisma.order.findUnique({
    where: { stripePaymentIntentId: piId },
    include: { items: true },
  });

  if (!order) {
    console.error(`[WEBHOOK] No order found for PaymentIntent ${piId}`);
    return;
  }

  if (order.status !== 'pending') {
    console.log(`[WEBHOOK] Order ${order.orderNumber} already ${order.status}. Skipping.`);
    return;
  }

  // Update order status to paid
  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'paid' },
  });

  // Deduct inventory for each line item
  // [AV-033] Capture before/after stock levels for inventory alert check.
  // The alert check runs AFTER all deductions succeed. If the alert fails,
  // order processing continues normally — see inventoryAlerts.js.
  const inventoryChanges = [];
  for (const item of order.items) {
    // Read current stock BEFORE deduction (for threshold transition detection)
    const variantBefore = await prisma.variant.findUnique({
      where: { id: item.variantId },
      select: { stockQty: true },
    });
    const stockBefore = variantBefore?.stockQty ?? 0;

    await prisma.variant.update({
      where: { id: item.variantId },
      data: { stockQty: { decrement: item.quantity } },
    });

    inventoryChanges.push({
      variantId: item.variantId,
      productName: item.productName,
      colorName: item.colorName,
      sizeName: item.sizeName,
      quantity: item.quantity,
      stockBefore,
      stockAfter: stockBefore - item.quantity,
    });
  }

  console.log(
    `[WEBHOOK] Order ${order.orderNumber} confirmed — ${order.items.length} items, $${Number(order.total).toFixed(2)}`
  );

  // Send confirmation email (non-blocking — failure logged, order unaffected)
  await sendOrderConfirmation({ ...order, items: order.items });

  // [AV-033] Check inventory thresholds and send alerts if any variant
  // crossed below warning (15) or reorder (5) level. This is fire-and-forget:
  // if it fails, the order is already confirmed and the customer is unaffected.
  // To rollback this feature: remove this try/catch block and the import above.
  try {
    await checkInventoryLevels(inventoryChanges);
  } catch (alertError) {
    console.error('[WEBHOOK] Inventory alert error (non-fatal):', alertError.message);
  }

  return order;
}

// ===== PAYMENT FAILED HANDLER =====
async function handlePaymentFailed(paymentIntent) {
  const email = paymentIntent.metadata?.email || 'unknown';
  const reason = paymentIntent.last_payment_error?.message || 'Unknown reason';

  console.log(`[WEBHOOK] Payment failed for ${email}: ${reason}`);

  // In production: could notify admin, send failure email to customer,
  // or create a failed-payment record for analytics.
}

module.exports = router;
