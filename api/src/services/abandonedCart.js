/**
 * Abandoned Cart Service — ANTIVAXXER
 *
 * [AV-031] feat: abandoned cart recovery
 *
 * Saves cart state when email is entered at checkout.
 * Checks for abandoned carts (no matching order after configurable delay).
 * Sends recovery email with link to restore cart.
 *
 * Recovery delay is configurable via ABANDONED_CART_DELAY_MS.
 * Default: 1 hour (3600000ms).
 */

const crypto = require('crypto');
const { prisma } = require('../lib/prisma');
const { sendAbandonedCartEmail } = require('./email');

// Configurable delay before sending recovery email
const RECOVERY_DELAY_MS = parseInt(process.env.ABANDONED_CART_DELAY_MS || '3600000', 10);

/**
 * Save or update an abandoned cart when email is entered at checkout.
 */
async function saveAbandonedCart(email, cartData) {
  const recoveryToken = crypto.randomBytes(32).toString('hex');

  // Upsert: update if same email has an unrecovered cart, create otherwise
  const existing = await prisma.abandonedCart.findFirst({
    where: { email, recovered: false },
    orderBy: { createdAt: 'desc' },
  });

  if (existing) {
    return prisma.abandonedCart.update({
      where: { id: existing.id },
      data: { cartData, updatedAt: new Date() },
    });
  }

  return prisma.abandonedCart.create({
    data: { email, cartData, recoveryToken },
  });
}

/**
 * Find abandoned carts that need recovery emails.
 * Criteria: older than RECOVERY_DELAY_MS, not recovered, email not sent.
 */
async function findAbandonedCarts() {
  const cutoff = new Date(Date.now() - RECOVERY_DELAY_MS);

  return prisma.abandonedCart.findMany({
    where: {
      recovered: false,
      emailSentAt: null,
      createdAt: { lt: cutoff },
    },
    take: 50, // Process in batches
  });
}

/**
 * Process abandoned carts — send recovery emails.
 * Call this from a cron job or scheduled task.
 */
async function processAbandonedCarts() {
  const carts = await findAbandonedCarts();

  for (const cart of carts) {
    // Check if the customer completed an order since cart was created
    const order = await prisma.order.findFirst({
      where: {
        email: cart.email,
        status: { not: 'pending' },
        createdAt: { gt: cart.createdAt },
      },
    });

    if (order) {
      // Customer completed purchase — mark as recovered
      await prisma.abandonedCart.update({
        where: { id: cart.id },
        data: { recovered: true },
      });
      continue;
    }

    // Send recovery email
    try {
      await sendAbandonedCartEmail(cart);
      await prisma.abandonedCart.update({
        where: { id: cart.id },
        data: { emailSentAt: new Date() },
      });
      console.log(`[ABANDONED] Recovery email sent to ${cart.email}`);
    } catch (error) {
      console.error(`[ABANDONED] Failed to send to ${cart.email}:`, error.message);
    }
  }

  return carts.length;
}

/**
 * Recover a cart by token — returns cart data for restoring.
 */
async function recoverCart(token) {
  const cart = await prisma.abandonedCart.findUnique({
    where: { recoveryToken: token },
  });

  if (!cart || cart.recovered) return null;

  await prisma.abandonedCart.update({
    where: { id: cart.id },
    data: { recovered: true },
  });

  return cart.cartData;
}

/**
 * Clean up old abandoned carts (>7 days).
 */
async function cleanupAbandonedCarts() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const { count } = await prisma.abandonedCart.deleteMany({
    where: {
      OR: [
        { recovered: true, createdAt: { lt: cutoff } },
        { emailSentAt: { not: null }, createdAt: { lt: cutoff } },
      ],
    },
  });

  if (count > 0) console.log(`[ABANDONED] Cleaned up ${count} old carts`);
  return count;
}

module.exports = {
  saveAbandonedCart,
  findAbandonedCarts,
  processAbandonedCarts,
  recoverCart,
  cleanupAbandonedCarts,
  RECOVERY_DELAY_MS,
};
