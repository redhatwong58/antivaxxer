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
const { sendOrderConfirmation, sendFulfillmentEmail } = require('../services/email');
// [AV-033] Inventory alerts — fire-and-forget after inventory deduction
const { checkInventoryLevels } = require('../services/inventoryAlerts');

// [AV-061] v5.4.2 — centralized Stripe init with timeout + retry
const stripe = require('../lib/stripe');

// ===== POST /api/webhooks/stripe =====
router.post(
  '/stripe',
  express.raw({ type: 'application/json' }),
  async (req, res) => {
    const sig = req.headers['stripe-signature'];
    const clientIp = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    const bodyLen = req.body?.length || 0;

    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.error('[WEBHOOK] STRIPE_WEBHOOK_SECRET not configured.');
      return res.status(500).send('Webhook not configured.');
    }

    let event;

    // Verify signature
    // [AV-057] v5.3.9 — richer logging on verification failure for forgery investigation
    try {
      event = stripe.webhooks.constructEvent(
        req.body,
        sig,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('[WEBHOOK] Signature verification failed', {
        error: err.message,
        ip: clientIp,
        sigPrefix: sig ? String(sig).slice(0, 30) : 'missing',
        bodyLen,
      });
      return res.status(400).send(`Webhook Error: ${err.message}`);
    }

    // Process event
    // [AV-057] v5.3.9 — on failure, write to FailedWebhook dead-letter queue
    // so ops can retry manually. Also send an admin alert email so failures
    // don't rot in console logs. Returns 200 to prevent Stripe retry storms.
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
      console.error(`[WEBHOOK] Error processing ${event.type} (${event.id}):`, err.message, err.stack);

      // Write to the dead-letter queue so it's recoverable
      try {
        await prisma.failedWebhook.create({
          data: {
            source: 'stripe',
            eventType: event.type,
            eventId: event.id,
            payload: event,
            errorMessage: err.message || 'Unknown error',
          },
        });
      } catch (dlqErr) {
        // If even the DLQ write fails, we're in trouble. Log loudly.
        console.error(
          '[WEBHOOK] FATAL: failed to write to dead-letter queue. Event LOST:',
          event.id,
          dlqErr.message
        );
      }

      // Send admin alert (fire-and-forget; won't block the webhook ack)
      try {
        const { sendWebhookFailureAlert } = require('../services/email');
        await sendWebhookFailureAlert({
          eventType: event.type,
          eventId: event.id,
          errorMessage: err.message,
        });
      } catch (alertErr) {
        console.error('[WEBHOOK] Admin alert failed (non-fatal):', alertErr.message);
      }
    }

    // Always return 200 to acknowledge receipt
    res.json({ received: true });
  }
);

// ===== PAYMENT SUCCESS HANDLER =====
// [AV-057] v5.3.9 — wraps the entire inventory deduction in a Prisma
// transaction with row locks (SELECT FOR UPDATE) so:
//   1. Order status + all variant decrements are atomic. If any step fails,
//      the entire transaction rolls back and nothing is half-applied.
//   2. Concurrent orders for the same low-stock variant can't oversell. The
//      row lock makes the second transaction wait until the first commits,
//      at which point it sees the updated stock count and either succeeds
//      or fails cleanly with a stock shortage error.
//
// Idempotency: the transaction checks `order.status === 'pending'` INSIDE
// the transaction. If two webhook deliveries race for the same order
// (Stripe retry + original succeed at the same time), only one will see
// status='pending' and do the work; the other becomes a no-op.
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

  // === ATOMIC TRANSACTION with row locks ===
  // Everything below happens or nothing does. Concurrent orders for the
  // same variant are serialized by the row locks. If ANY step fails
  // (DB error, insufficient stock, etc.), the transaction rolls back
  // and the caller handles the error.
  const inventoryChanges = await prisma.$transaction(async (tx) => {
    // Re-check status INSIDE the transaction with a row lock so two
    // concurrent webhook deliveries can't both process the same order.
    // Using $queryRaw for "SELECT ... FOR UPDATE" since Prisma doesn't
    // expose row locking directly.
    const orderLock = await tx.$queryRaw`
      SELECT id, status FROM orders WHERE id = ${order.id} FOR UPDATE
    `;
    if (!orderLock[0] || orderLock[0].status !== 'pending') {
      console.log(`[WEBHOOK] Order ${order.orderNumber} status changed mid-transaction. Skipping.`);
      return []; // Empty inventoryChanges — no-op
    }

    // Lock and decrement each variant with an explicit stock check.
    // The FOR UPDATE lock makes concurrent deductions wait, preventing
    // the classic "both read 2, both decrement, end up with 1" race.
    const changes = [];
    for (const item of order.items) {
      // Row-locked read
      const variantRows = await tx.$queryRaw`
        SELECT id, stock_qty FROM variants WHERE id = ${item.variantId} FOR UPDATE
      `;
      if (!variantRows[0]) {
        throw new Error(`Variant ${item.variantId} not found for order ${order.orderNumber}`);
      }
      const stockBefore = Number(variantRows[0].stock_qty);

      if (stockBefore < item.quantity) {
        // Should never happen — checkout validates stock before creating the
        // pending order — but if it does, bail hard so the webhook retries.
        // This will be caught by the outer try/catch and land in the DLQ.
        throw new Error(
          `Insufficient stock for variant ${item.variantId}: need ${item.quantity}, have ${stockBefore}. ` +
          `Order ${order.orderNumber} cannot be processed.`
        );
      }

      await tx.variant.update({
        where: { id: item.variantId },
        data: { stockQty: { decrement: item.quantity } },
      });

      changes.push({
        variantId: item.variantId,
        productName: item.productName,
        colorName: item.colorName,
        sizeName: item.sizeName,
        quantity: item.quantity,
        stockBefore,
        stockAfter: stockBefore - item.quantity,
      });
    }

    // Move order status to processing — this must be inside the transaction
    // so that if any variant decrement fails, the order stays pending and
    // the webhook gets retried (via DLQ).
    // [AV-052] v5.3.7 — straight to processing (see comment elsewhere)
    await tx.order.update({
      where: { id: order.id },
      data: { status: 'processing' },
    });

    return changes;
  });

  // If inventoryChanges is empty, the order was already processed by a
  // concurrent webhook — nothing more to do.
  if (inventoryChanges.length === 0) {
    return;
  }

  console.log(
    `[WEBHOOK] Order ${order.orderNumber} confirmed — ${order.items.length} items, $${Number(order.total).toFixed(2)}`
  );

  // Send confirmation email (non-blocking — failure logged, order unaffected)
  await sendOrderConfirmation({ ...order, items: order.items });

  // [AV-055] v5.3.8 — Send per-order fulfillment email to ops with the
  // packing slip + post-deduction inventory snapshot. Fire-and-forget:
  // the order is already confirmed regardless of email success.
  try {
    await sendFulfillmentEmail({
      order: { ...order, items: order.items },
      inventoryChanges,
    });
  } catch (fulfillError) {
    console.error('[WEBHOOK] Fulfillment email error (non-fatal):', fulfillError.message);
  }

  // [AV-033] Check inventory thresholds and send alerts if any variant
  // crossed below warning (15) or reorder (5) level. This is fire-and-forget:
  // if it fails, the order is already confirmed and the customer is unaffected.
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

// ============================================================
// [AV-058] v5.4.0 — SHIPPO TRACKING WEBHOOK
// ============================================================
// Shippo sends POST requests to this endpoint when tracking status changes.
// Configure the webhook URL in Shippo dashboard → Settings → Webhooks:
//   URL: https://api.antivaxxer.com/api/webhooks/shippo
//   Event: track_updated
//
// Shippo tracking statuses we care about:
//   DELIVERED → transition order to "delivered", set deliveredAt
//   RETURNED  → could indicate a return, log it
//   FAILURE   → delivery failure, log it
//
// Unlike Stripe webhooks, Shippo webhooks don't have a signature
// verification mechanism. We validate by checking that the tracking
// number matches an order in our database.

router.post(
  '/shippo',
  express.json(),
  async (req, res) => {
    try {
      const { data, event } = req.body;

      if (event !== 'track_updated') {
        console.log(`[SHIPPO WEBHOOK] Ignoring event: ${event}`);
        return res.json({ received: true });
      }

      const trackingNumber = data?.tracking_number;
      const trackingStatus = data?.tracking_status?.status;
      const carrier = data?.carrier;

      if (!trackingNumber || !trackingStatus) {
        console.warn('[SHIPPO WEBHOOK] Missing tracking_number or status in payload');
        return res.json({ received: true });
      }

      console.log(`[SHIPPO WEBHOOK] ${trackingNumber} → ${trackingStatus} (${carrier || 'unknown'})`);

      // Find the order by tracking number
      const order = await prisma.order.findFirst({
        where: { trackingNumber },
      });

      if (!order) {
        console.warn(`[SHIPPO WEBHOOK] No order found for tracking ${trackingNumber}. Ignoring.`);
        return res.json({ received: true });
      }

      // Handle status transitions
      if (trackingStatus === 'DELIVERED' && order.status !== 'delivered') {
        const timestamp = new Date().toISOString();
        const auditLine = `[${timestamp}] Shippo tracking: delivered. Carrier: ${carrier || order.carrier || 'unknown'}`;
        const newNotes = order.notes ? `${order.notes}\n${auditLine}` : auditLine;

        await prisma.order.update({
          where: { id: order.id },
          data: {
            status: 'delivered',
            deliveredAt: new Date(),
            notes: newNotes,
          },
        });
        console.log(`[SHIPPO WEBHOOK] Order ${order.orderNumber} marked delivered`);

        // [AV-060] v5.4.1 — send delivery confirmation email to customer
        try {
          const { sendDeliveryConfirmation } = require('../services/email');
          await sendDeliveryConfirmation(order);
        } catch (emailErr) {
          console.error('[SHIPPO WEBHOOK] Delivery email failed (non-fatal):', emailErr.message);
        }
      } else if (trackingStatus === 'RETURNED') {
        const timestamp = new Date().toISOString();
        const auditLine = `[${timestamp}] Shippo tracking: package RETURNED. Manual review needed.`;
        const newNotes = order.notes ? `${order.notes}\n${auditLine}` : auditLine;

        await prisma.order.update({
          where: { id: order.id },
          data: { notes: newNotes },
        });
        console.log(`[SHIPPO WEBHOOK] Order ${order.orderNumber} — package returned. Needs manual review.`);
      } else if (trackingStatus === 'FAILURE') {
        const timestamp = new Date().toISOString();
        const auditLine = `[${timestamp}] Shippo tracking: delivery FAILURE. Check carrier dashboard for details.`;
        const newNotes = order.notes ? `${order.notes}\n${auditLine}` : auditLine;

        await prisma.order.update({
          where: { id: order.id },
          data: { notes: newNotes },
        });
        console.log(`[SHIPPO WEBHOOK] Order ${order.orderNumber} — delivery failure. Needs attention.`);
      }
      // Other statuses (TRANSIT, PRE_TRANSIT, UNKNOWN) are informational — we log but don't act

      return res.json({ received: true });
    } catch (err) {
      console.error('[SHIPPO WEBHOOK] Error:', err.message);
      // Write to DLQ so ops can investigate
      try {
        await prisma.failedWebhook.create({
          data: {
            source: 'shippo',
            eventType: req.body?.event || 'unknown',
            eventId: req.body?.data?.tracking_number || 'unknown',
            payload: req.body,
            errorMessage: err.message || 'Unknown error',
          },
        });
      } catch (dlqErr) {
        console.error('[SHIPPO WEBHOOK] DLQ write also failed:', dlqErr.message);
      }
      return res.json({ received: true }); // always 200 — don't block Shippo retries
    }
  }
);

module.exports = router;
// [AV-057] v5.3.9 — expose handlePaymentSuccess so the DLQ retry endpoint
// can replay events directly without going through the HTTP signature check.
module.exports.handlePaymentSuccess = handlePaymentSuccess;
