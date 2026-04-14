/**
 * Shared Constants — ANTIVAXXER
 *
 * [AV-000] chore: project scaffolding
 *
 * Values used by both frontend and API. Single source of truth
 * to prevent drift between client and server.
 */

// Product categories — matches database seed (Step 3)
const CATEGORIES = [
  { slug: 'tees', name: 'Tees' },
  { slug: 'long-sleeve', name: 'Long Sleeve' },
  { slug: 'crewneck', name: 'Crewneck' },
  { slug: 'hoodie', name: 'Hoodie' },
  { slug: 'hat', name: 'Hats' },
  { slug: 'collab', name: 'Collabs' },
  { slug: 'accessories', name: 'Accessories' },
];

// Standard sizes — order matters for display
const SIZES = ['S', 'M', 'L', 'XL', '2XL', '3XL', 'OS'];

// Order statuses — used in admin and user order history
const ORDER_STATUSES = {
  PENDING: 'pending',
  PAID: 'paid',
  PROCESSING: 'processing',
  SHIPPED: 'shipped',
  DELIVERED: 'delivered',
  CANCELLED: 'cancelled',
  REFUNDED: 'refunded',
};

// Product statuses
const PRODUCT_STATUSES = {
  ACTIVE: 'active',
  DRAFT: 'draft',
  ARCHIVED: 'archived',
};

// Badge types displayed on product cards
const BADGES = ['BESTSELLER', 'NEW', 'HOT', 'COLLAB'];

// Shipping rates — easily configurable here
// Future: replaced by Shippo or carrier API integration
const SHIPPING = {
  FLAT_RATE: 5.99,
  FREE_THRESHOLD: 75.0, // Free shipping on orders at or above this amount
  FREE_LABEL: 'Free Shipping',
  FLAT_LABEL: 'Standard Shipping (5-7 business days)',
};

// Promo code for launch (validated in Phase 3 promo engine)
const LAUNCH_PROMO_CODE = 'ANTIVAX25';
const LAUNCH_PROMO_DISCOUNT = 0.25; // 25%

module.exports = {
  CATEGORIES,
  SIZES,
  ORDER_STATUSES,
  PRODUCT_STATUSES,
  BADGES,
  SHIPPING,
  LAUNCH_PROMO_CODE,
  LAUNCH_PROMO_DISCOUNT,
};
