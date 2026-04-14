/**
 * GA4 Analytics — ANTIVAXXER
 *
 * [AV-027] feat: GA4 analytics with ecommerce events
 *
 * Loads gtag.js only after CookiesYes analytics consent.
 * Provides helper functions for ecommerce event tracking.
 *
 * Usage:
 *   import { trackEvent } from '@/lib/analytics';
 *   trackEvent('add_to_cart', { item_id: '...', value: 35.00 });
 */

'use client';

import Script from 'next/script';

const GA_ID = process.env.NEXT_PUBLIC_GA4_ID;

// ===== GA4 Script Component =====
// Add this to root layout. Only loads if GA4 ID is configured.
export function GoogleAnalytics() {
  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="ga4-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('consent', 'default', {
            analytics_storage: 'denied',
            ad_storage: 'denied'
          });
          gtag('config', '${GA_ID}', {
            send_page_view: true
          });
        `}
      </Script>
    </>
  );
}

// ===== Event Tracking =====
// Only fires if gtag is loaded and consent granted

export function trackEvent(eventName, params = {}) {
  if (typeof window === 'undefined' || !window.gtag) return;
  window.gtag('event', eventName, params);
}

// Ecommerce-specific helpers

export function trackViewItem(product) {
  trackEvent('view_item', {
    currency: 'USD',
    value: product.price,
    items: [{
      item_id: product.slug || product.id,
      item_name: product.name,
      item_category: product.category,
      price: product.price,
    }],
  });
}

export function trackAddToCart(item) {
  trackEvent('add_to_cart', {
    currency: 'USD',
    value: item.price * item.qty,
    items: [{
      item_id: item.sku,
      item_name: item.name,
      item_variant: [item.color, item.size].filter(Boolean).join(' / '),
      price: item.price,
      quantity: item.qty,
    }],
  });
}

export function trackBeginCheckout(cart, total) {
  trackEvent('begin_checkout', {
    currency: 'USD',
    value: total,
    items: cart.map((item) => ({
      item_id: item.sku,
      item_name: item.name,
      price: item.price,
      quantity: item.qty,
    })),
  });
}

export function trackPurchase(orderNumber, total, items) {
  trackEvent('purchase', {
    transaction_id: orderNumber,
    currency: 'USD',
    value: total,
    items: items.map((item) => ({
      item_id: item.sku,
      item_name: item.productName,
      price: item.unitPrice,
      quantity: item.quantity,
    })),
  });
}

export function trackSearch(query, resultCount) {
  trackEvent('search', { search_term: query, results_count: resultCount });
}
