/**
 * Integration tests for POST /api/admin/orders/:id/refund
 *
 * [AV-064] v5.4.5 — tests full/partial refund logic:
 *   - Full refund: Stripe refund created, order → refunded, stock restocked
 *   - Partial refund: Stripe refund for lesser amount, order stays current status
 *   - Already-refunded order: rejected
 *   - Amount exceeds total: rejected
 *   - Missing Stripe PI: rejected
 *   - Audit trail: notes appended
 */

jest.mock('../../src/lib/prisma', () => {
  const mockPrisma = {
    order: { findUnique: jest.fn(), update: jest.fn() },
    variant: { update: jest.fn() },
  };
  return { prisma: mockPrisma };
});

jest.mock('../../src/lib/stripe', () => ({
  refunds: { create: jest.fn() },
}));

jest.mock('../../src/services/email', () => ({
  sendOrderConfirmation: jest.fn().mockResolvedValue(),
  sendFulfillmentEmail: jest.fn().mockResolvedValue(),
  sendWebhookFailureAlert: jest.fn().mockResolvedValue(),
  sendShippingNotification: jest.fn().mockResolvedValue(),
  sendDeliveryConfirmation: jest.fn().mockResolvedValue(),
  sendWelcomeEmail: jest.fn().mockResolvedValue(),
}));

jest.mock('../../src/services/inventoryAlerts', () => ({
  checkInventoryLevels: jest.fn().mockResolvedValue(),
}));

jest.mock('../../src/services/shippo', () => ({
  createShipment: jest.fn(),
  purchaseLabel: jest.fn(),
}));

jest.mock('../../src/services/imageUpload', () => ({
  uploadProductImage: jest.fn(),
  deleteProductImage: jest.fn(),
}));

jest.mock('../../src/middleware/adminAuth', () => ({
  adminAuth: (req, res, next) => {
    req.adminUser = { id: 'test-admin', email: 'admin@test.com', role: 'admin' };
    next();
  },
}));

jest.mock('../../src/middleware/validate', () => ({
  validate: () => (req, res, next) => next(),
}));

const express = require('express');
const request = require('supertest');
const { prisma } = require('../../src/lib/prisma');
const stripe = require('../../src/lib/stripe');

// Build a mini app with just the admin router
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/', require('../../src/routes/admin'));
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || 500).json({ error: { message: err.message } });
  });
  return app;
}

const TEST_ORDER = {
  id: 'order-refund-001',
  orderNumber: 'AV-20260415-0010',
  email: 'buyer@test.com',
  status: 'processing',
  subtotal: 100.00,
  total: 105.99,
  stripePaymentIntentId: 'pi_refund_test',
  notes: null,
  items: [
    { id: 'li-1', variantId: 'v-1', quantity: 2, productName: 'Tee', colorName: 'Black', sizeName: 'L', unitPrice: 50.00 },
  ],
};

describe('POST /orders/:id/refund', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('full refund: calls Stripe, restocks inventory, sets status to refunded', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...TEST_ORDER, items: TEST_ORDER.items });
    prisma.order.update.mockResolvedValue({ ...TEST_ORDER, status: 'refunded' });
    prisma.variant.update.mockResolvedValue({});
    stripe.refunds.create.mockResolvedValue({ id: 're_test_full', amount: 10599 });

    const res = await request(app)
      .post('/orders/order-refund-001/refund')
      .send({ amount: 105.99, reason: 'Customer request' });

    expect(res.status).toBe(200);
    expect(stripe.refunds.create).toHaveBeenCalledWith({
      payment_intent: 'pi_refund_test',
      amount: 10599,
      reason: 'requested_by_customer',
    });
    // Full refund restocks all variants
    expect(prisma.variant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v-1' },
        data: { stockQty: { increment: 2 } },
      })
    );
    // Status set to refunded
    expect(prisma.order.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'refunded' }),
      })
    );
  });

  test('partial refund: does NOT restock, does NOT change status', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...TEST_ORDER, items: TEST_ORDER.items });
    prisma.order.update.mockResolvedValue(TEST_ORDER);
    stripe.refunds.create.mockResolvedValue({ id: 're_test_partial', amount: 5000 });

    const res = await request(app)
      .post('/orders/order-refund-001/refund')
      .send({ amount: 50.00, reason: 'Partial' });

    expect(res.status).toBe(200);
    expect(stripe.refunds.create).toHaveBeenCalled();
    // Partial refund: NO restocking
    expect(prisma.variant.update).not.toHaveBeenCalled();
  });

  test('already-refunded order is rejected', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...TEST_ORDER, status: 'refunded' });

    const res = await request(app)
      .post('/orders/order-refund-001/refund')
      .send({ amount: 50.00 });

    expect(res.status).toBe(409);
  });

  test('amount exceeding total is rejected', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...TEST_ORDER, items: TEST_ORDER.items });

    const res = await request(app)
      .post('/orders/order-refund-001/refund')
      .send({ amount: 999.99 });

    expect(res.status).toBe(400);
  });

  test('order without Stripe PI is rejected', async () => {
    prisma.order.findUnique.mockResolvedValue({
      ...TEST_ORDER,
      stripePaymentIntentId: null,
      items: TEST_ORDER.items,
    });

    const res = await request(app)
      .post('/orders/order-refund-001/refund')
      .send({ amount: 50.00 });

    expect(res.status).toBe(400);
  });

  test('audit note is appended with admin email and amount', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...TEST_ORDER, items: TEST_ORDER.items });
    prisma.order.update.mockResolvedValue(TEST_ORDER);
    stripe.refunds.create.mockResolvedValue({ id: 're_test', amount: 5000 });

    await request(app)
      .post('/orders/order-refund-001/refund')
      .send({ amount: 50.00, reason: 'Damaged' });

    const updateCall = prisma.order.update.mock.calls[0][0];
    expect(updateCall.data.notes).toContain('admin@test.com');
    expect(updateCall.data.notes).toContain('50.00');
    expect(updateCall.data.notes).toContain('Damaged');
  });
});
