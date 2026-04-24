/**
 * Checkout Validation Schemas — Zod
 *
 * [AV-011] feat: stripe payment intent endpoint
 *
 * Validates checkout inputs. Cart items verified against database
 * in the route handler (prices never trusted from client).
 */

const { z } = require('zod');

const addressSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  line1: z.string().min(1, 'Address is required').max(255),
  line2: z.string().max(255).optional().default(''),
  city: z.string().min(1, 'City is required').max(100),
  state: z.string().length(2, 'State must be 2-letter code'),
  zip: z.string().min(5, 'ZIP code is required').max(10),
  country: z.string().length(2).optional().default('US'),
});

const createPaymentIntentBody = z.object({
  email: z.string().email('Valid email is required'),
  items: z
    .array(
      z.object({
        variantId: z.string().uuid('Invalid variant ID'),
        quantity: z.number().int().min(1).max(99),
      })
    )
    .min(1, 'Cart cannot be empty'),
  shippingAddress: addressSchema,
  billingAddress: addressSchema,
  sameAsShipping: z.boolean().optional().default(false),
  // [AV-059] v5.4.0 — optional promo code
  promoCode: z.string().max(50).optional().default(''),
});

module.exports = {
  createPaymentIntentBody,
  addressSchema,
};
