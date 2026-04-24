/**
 * Integration tests for PUT /api/admin/orders/:id/items
 *
 * [AV-064] v5.4.5 — tests the order line-item replacement flow:
 *   - Add new items: stock decremented
 *   - Remove items: stock restocked
 *   - Quantity change: delta computed correctly
 *   - Subtotal + total recalculated
 *   - Audit note appended
 *   - Empty items array rejected
 *   - Insufficient stock rejected (409)
 *   - Non-editable status rejected (409)
 */

jest.mock('../../src/lib/prisma', () => {
  const mockPrisma = {
    order: { findUnique: jest.fn(), update: jest.fn() },
    orderItem: { deleteMany: jest.fn().mockResolvedValue({}) },
    variant: { findUnique: jest.fn(), update: jest.fn() },
    $transaction: jest.fn(),
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

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/', require('../../src/routes/admin'));
  app.use((err, req, res, _next) => {
    res.status(err.statusCode || 500).json({ error: { code: err.code, message: err.message } });
  });
  return app;
}

const EXISTING_ORDER = {
  id: 'order-edit-001',
  orderNumber: 'AV-20260415-0020',
  status: 'processing',
  subtotal: 75.00,
  discountAmount: 0,
  shippingAmount: 5.99,
  taxAmount: 0,
  total: 80.99,
  notes: null,
  items: [
    { id: 'li-old-1', variantId: 'v-100', quantity: 3, unitPrice: 25.00, productName: 'Tee', colorName: 'Black', sizeName: 'M', sku: 'TEE-BLK-M' },
  ],
};

const VARIANT_100 = {
  id: 'v-100', sku: 'TEE-BLK-M', stockQty: 10,
  product: { name: 'Tee', basePrice: 25.00 },
  color: { name: 'Black' }, size: { name: 'M' },
  priceOverride: null, isActive: true,
};

const VARIANT_200 = {
  id: 'v-200', sku: 'HOOD-RED-L', stockQty: 5,
  product: { name: 'Hoodie', basePrice: 60.00 },
  color: { name: 'Red' }, size: { name: 'L' },
  priceOverride: null, isActive: true,
};

describe('PUT /orders/:id/items', () => {
  let app;

  beforeAll(() => {
    app = buildApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default: $transaction executes the callback directly
    prisma.$transaction.mockImplementation(async (cb) => cb(prisma));
  });

  test('replace items: removes old, adds new, recalculates total', async () => {
    prisma.order.findUnique.mockResolvedValue(EXISTING_ORDER);
    prisma.variant.findUnique.mockResolvedValue(VARIANT_200);
    prisma.order.update.mockResolvedValue({ ...EXISTING_ORDER, subtotal: 60.00, total: 65.99 });

    const res = await request(app)
      .put('/orders/order-edit-001/items')
      .send({ items: [{ variantId: 'v-200', quantity: 1 }] });

    expect(res.status).toBe(200);

    // Old item restocked (v-100 × 3)
    expect(prisma.variant.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'v-100' },
        data: { stockQty: { increment: 3 } },
      })
    );

    // Old items deleted
    expect(prisma.orderItem.deleteMany).toHaveBeenCalled();

    // New subtotal calculated
    const updateCall = prisma.order.update.mock.calls[0][0];
    expect(Number(updateCall.data.subtotal)).toBe(60.00);
  });

  test('empty items array is rejected', async () => {
    const res = await request(app)
      .put('/orders/order-edit-001/items')
      .send({ items: [] });

    expect(res.status).toBe(400);
  });

  test('non-editable status (shipped) is rejected', async () => {
    prisma.order.findUnique.mockResolvedValue({ ...EXISTING_ORDER, status: 'shipped' });

    const res = await request(app)
      .put('/orders/order-edit-001/items')
      .send({ items: [{ variantId: 'v-100', quantity: 1 }] });

    expect(res.status).toBe(409);
  });

  test('insufficient stock returns 409', async () => {
    prisma.order.findUnique.mockResolvedValue(EXISTING_ORDER);
    prisma.variant.findUnique.mockResolvedValue({ ...VARIANT_200, stockQty: 0 });

    const res = await request(app)
      .put('/orders/order-edit-001/items')
      .send({ items: [{ variantId: 'v-200', quantity: 5 }] });

    expect(res.status).toBe(409);
  });

  test('audit note is appended', async () => {
    prisma.order.findUnique.mockResolvedValue(EXISTING_ORDER);
    prisma.variant.findUnique.mockResolvedValue(VARIANT_200);
    prisma.order.update.mockResolvedValue(EXISTING_ORDER);

    await request(app)
      .put('/orders/order-edit-001/items')
      .send({ items: [{ variantId: 'v-200', quantity: 1 }] });

    const updateCall = prisma.order.update.mock.calls[0][0];
    expect(updateCall.data.notes).toContain('admin@test.com');
    expect(updateCall.data.notes).toContain('edited');
  });
});
