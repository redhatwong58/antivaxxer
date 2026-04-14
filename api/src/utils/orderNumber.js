/**
 * Order Number Generator — ANTIVAXXER
 *
 * [AV-010] feat: order data model
 *
 * Generates sequential order numbers in format: AV-{YEAR}-{5_DIGIT}
 * Example: AV-2025-00042
 *
 * Queries the database for the highest existing order number
 * in the current year and increments by 1.
 */

const { prisma } = require('../lib/prisma');

async function generateOrderNumber() {
  const year = new Date().getFullYear();
  const prefix = `AV-${year}-`;

  // Find the highest order number for this year
  const lastOrder = await prisma.order.findFirst({
    where: {
      orderNumber: { startsWith: prefix },
    },
    orderBy: { orderNumber: 'desc' },
    select: { orderNumber: true },
  });

  let nextNum = 1;
  if (lastOrder) {
    const lastNum = parseInt(lastOrder.orderNumber.replace(prefix, ''), 10);
    if (!isNaN(lastNum)) {
      nextNum = lastNum + 1;
    }
  }

  return `${prefix}${String(nextNum).padStart(5, '0')}`;
}

module.exports = { generateOrderNumber };
