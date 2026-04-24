/**
 * Integration tests for handlePaymentSuccess
 *
 * [AV-064] v5.4.5 — tests the atomic webhook inventory deduction:
 *   - Happy path: order found, stock sufficient, deduction + status change
 *   - Idempotency: already-processed order is skipped
 *   - Insufficient stock: throws, transaction rolls back
 *   - Missing order: returns without error
 *   - Missing variant: throws
 */

// Mock all dependencies BEFORE requiring the module under test
jest.mock('../../src/lib/prisma', () => ({ prisma: {} }));
jest.mock('../../src/lib/stripe', () => ({
  webhooks: { constructEvent: jest.fn() },
}));
jest.mock('../../src/services/email', () => ({
  sendOrderConfirmation: jest.fn().mockResolvedValue(),
  sendFulfillmentEmail: jest.fn().mockResolvedValue(),
  sendWebhookFailureAlert: jest.fn().mockResolvedValue(),
  sendShippingNotification: jest.fn().mockResolvedValue(),
  sendDeliveryConfirmation: jest.fn().mockResolvedValue(),
}));
jest.mock('../../src/services/inventoryAlerts', () => ({
  checkInventoryLevels: jest.fn().mockResolvedValue(),
}));

const { prisma } = require('../../src/lib/prisma');
const { sendOrderConfirmation, sendFulfillmentEmail } = require('../../src/services/email');
const { checkInventoryLevels } = require('../../src/services/inventoryAlerts');

// Import the exported handler
const webhooksModule = require('../../src/routes/webhooks');
const handlePaymentSuccess = webhooksModule.handlePaymentSuccess;

// === Test fixtures ===

const TEST_ORDER = {
  id: 'order-001',
  orderNumber: 'AV-20260415-0001',
  email: 'test@example.com',
  status: 'pending',
  subtotal: 50.00,
  total: 55.99,
  items: [
    {
      id: 'item-001',
      variantId: 'variant-aaa',
      productName: 'Freedom Tee',
      colorName: 'Black',
      sizeName: 'M',
      quantity: 2,
      unitPrice: 25.00,
    },
  ],
};

const TEST_PI = { id: 'pi_test_123' };

function setupPrismaMocks(overrides = {}) {
  // findUnique — returns the test order
  prisma.order = {
    findUnique: jest.fn().mockResolvedValue(overrides.order ?? TEST_ORDER),
    update: jest.fn().mockResolvedValue({ ...TEST_ORDER, status: 'processing' }),
  };

  // $transaction — executes the callback with a mock tx client
  const txClient = {
    $queryRaw: jest.fn(),
    order: { update: jest.fn().mockResolvedValue({ ...TEST_ORDER, status: 'processing' }) },
    variant: { update: jest.fn().mockResolvedValue({}) },
  };

  // Default $queryRaw responses: order lock returns pending, variant returns stock=10
  txClient.$queryRaw.mockImplementation((strings) => {
    const sql = Array.isArray(strings) ? strings.join('?') : String(strings);
    if (sql.includes('FROM orders')) {
      return Promise.resolve(overrides.orderLock ?? [{ id: TEST_ORDER.id, status: 'pending' }]);
    }
    if (sql.includes('FROM variants')) {
      return Promise.resolve(overrides.variantLock ?? [{ id: 'variant-aaa', stock_qty: overrides.stockQty ?? 10 }]);
    }
    return Promise.resolve([]);
  });

  prisma.$transaction = jest.fn((callback) => callback(txClient));

  return txClient;
}

// === Tests ===

describe('handlePaymentSuccess', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('happy path: deducts stock, sets status to processing, sends emails', async () => {
    const tx = setupPrismaMocks({ stockQty: 10 });

    await handlePaymentSuccess(TEST_PI);

    // Transaction was called
    expect(prisma.$transaction).toHaveBeenCalledTimes(1);

    // Order row locked inside tx
    expect(tx.$queryRaw).toHaveBeenCalledTimes(2); // once for order, once for variant

    // Variant decremented inside tx
    expect(tx.variant.update).toHaveBeenCalledWith({
      where: { id: 'variant-aaa' },
      data: { stockQty: { decrement: 2 } },
    });

    // Order status set to processing inside tx
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-001' },
      data: { status: 'processing' },
    });

    // Emails sent after transaction
    expect(sendOrderConfirmation).toHaveBeenCalledTimes(1);
    expect(sendFulfillmentEmail).toHaveBeenCalledTimes(1);
    expect(checkInventoryLevels).toHaveBeenCalledTimes(1);
  });

  test('idempotency: already-processed order is skipped (no transaction)', async () => {
    setupPrismaMocks({ order: { ...TEST_ORDER, status: 'processing' } });

    await handlePaymentSuccess(TEST_PI);

    expect(prisma.$transaction).not.toHaveBeenCalled();
    expect(sendOrderConfirmation).not.toHaveBeenCalled();
  });

  test('idempotency: status changed mid-transaction returns empty changes', async () => {
    const tx = setupPrismaMocks({
      orderLock: [{ id: TEST_ORDER.id, status: 'processing' }], // changed between outer check and tx
    });

    await handlePaymentSuccess(TEST_PI);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    // Transaction ran but returned [] — no emails
    expect(sendOrderConfirmation).not.toHaveBeenCalled();
    expect(tx.variant.update).not.toHaveBeenCalled();
  });

  test('insufficient stock: throws inside transaction (rolls back)', async () => {
    setupPrismaMocks({ stockQty: 1 }); // need 2, have 1

    await expect(handlePaymentSuccess(TEST_PI)).rejects.toThrow('Insufficient stock');
  });

  test('missing order: returns without error', async () => {
    setupPrismaMocks({ order: null });

    await handlePaymentSuccess(TEST_PI); // should not throw

    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  test('missing variant in lock query: throws', async () => {
    setupPrismaMocks({ variantLock: [] }); // variant not found

    await expect(handlePaymentSuccess(TEST_PI)).rejects.toThrow('not found');
  });

  test('email failure does not break the order flow', async () => {
    setupPrismaMocks();
    sendOrderConfirmation.mockRejectedValueOnce(new Error('SES down'));

    // Should not throw — email is fire-and-forget
    await handlePaymentSuccess(TEST_PI);

    expect(prisma.$transaction).toHaveBeenCalledTimes(1);
  });
});
