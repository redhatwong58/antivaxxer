/**
 * Shippo Service — ANTIVAXXER
 *
 * [AV-058] v5.4.0 — Shippo REST API integration for shipping label
 *   creation and tracking. Uses the Shippo REST API directly (no SDK).
 *
 * Environment:
 *   SHIPPO_API_KEY — Shippo API token (from Shippo dashboard → Settings → API)
 *   SHIPPO_FROM_NAME — sender name (default: "ANTIVAXXER")
 *   SHIPPO_FROM_STREET — sender address line 1
 *   SHIPPO_FROM_CITY, SHIPPO_FROM_STATE, SHIPPO_FROM_ZIP
 *   SHIPPO_FROM_COUNTRY — default "US"
 *   SHIPPO_FROM_EMAIL — sender email for label
 *
 * Flow:
 *   1. Admin clicks "Create Shipment" on an order → createShipment()
 *      sends the order's address + weight to Shippo, returns available rates
 *   2. Admin selects a rate → purchaseLabel() buys the label, returns
 *      label PDF URL + tracking number
 *   3. Shippo sends tracking updates to POST /api/webhooks/shippo as the
 *      package moves through the carrier network
 */

const SHIPPO_API = 'https://api.goshippo.com';

function getHeaders() {
  const apiKey = process.env.SHIPPO_API_KEY;
  if (!apiKey) throw new Error('SHIPPO_API_KEY not configured');
  return {
    'Authorization': `ShippoToken ${apiKey}`,
    'Content-Type': 'application/json',
  };
}

function getFromAddress() {
  return {
    name: process.env.SHIPPO_FROM_NAME || 'ANTIVAXXER',
    street1: process.env.SHIPPO_FROM_STREET || '',
    city: process.env.SHIPPO_FROM_CITY || '',
    state: process.env.SHIPPO_FROM_STATE || '',
    zip: process.env.SHIPPO_FROM_ZIP || '',
    country: process.env.SHIPPO_FROM_COUNTRY || 'US',
    email: process.env.SHIPPO_FROM_EMAIL || process.env.SES_FROM_EMAIL || '',
  };
}

/**
 * Create a shipment and get available rates.
 *
 * @param {Object} order — order with shippingAddress (JSON) and items
 * @param {number} weightOz — total package weight in ounces
 * @returns {{ shipmentId: string, rates: Array }} — shipment ID + available rates sorted by price
 */
async function createShipment(order, weightOz) {
  const addr = order.shippingAddress || {};
  if (!addr.line1 || !addr.city || !addr.state || !addr.zip) {
    throw new Error('Order is missing a complete shipping address');
  }

  const fromAddr = getFromAddress();
  if (!fromAddr.street1) {
    throw new Error(
      'Shippo sender address not configured. Set SHIPPO_FROM_STREET, SHIPPO_FROM_CITY, ' +
      'SHIPPO_FROM_STATE, SHIPPO_FROM_ZIP in your environment.'
    );
  }

  const body = {
    address_from: {
      name: fromAddr.name,
      street1: fromAddr.street1,
      city: fromAddr.city,
      state: fromAddr.state,
      zip: fromAddr.zip,
      country: fromAddr.country,
      email: fromAddr.email,
    },
    address_to: {
      name: `${addr.firstName || ''} ${addr.lastName || ''}`.trim() || 'Customer',
      street1: addr.line1,
      street2: addr.line2 || '',
      city: addr.city,
      state: addr.state,
      zip: addr.zip,
      country: addr.country || 'US',
      email: order.email,
    },
    parcels: [
      {
        length: '12',
        width: '10',
        height: '4',
        distance_unit: 'in',
        weight: String(Math.max(1, Math.round(weightOz || 16))),
        mass_unit: 'oz',
      },
    ],
    async: false, // get rates immediately in the response
  };

  const res = await fetch(`${SHIPPO_API}/shipments`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Shippo createShipment failed (${res.status}): ${JSON.stringify(err)}`);
  }

  const shipment = await res.json();

  // Sort rates by price ascending
  const rates = (shipment.rates || [])
    .filter((r) => r.amount && r.currency === 'USD')
    .sort((a, b) => parseFloat(a.amount) - parseFloat(b.amount))
    .map((r) => ({
      rateId: r.object_id,
      carrier: r.provider,
      service: r.servicelevel?.name || r.servicelevel?.token || 'Standard',
      serviceToken: r.servicelevel?.token || '',
      amount: parseFloat(r.amount),
      currency: r.currency,
      estimatedDays: r.estimated_days || null,
      durationTerms: r.duration_terms || null,
    }));

  return {
    shipmentId: shipment.object_id,
    rates,
  };
}

/**
 * Purchase a shipping label for a specific rate.
 *
 * @param {string} rateId — Shippo rate object_id from createShipment
 * @returns {{ transactionId, trackingNumber, trackingUrl, labelUrl, carrier, service }}
 */
async function purchaseLabel(rateId) {
  const body = {
    rate: rateId,
    label_file_type: 'PDF',
    async: false,
  };

  const res = await fetch(`${SHIPPO_API}/transactions`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Shippo purchaseLabel failed (${res.status}): ${JSON.stringify(err)}`);
  }

  const txn = await res.json();

  if (txn.status !== 'SUCCESS') {
    throw new Error(
      `Shippo label purchase not successful: status=${txn.status}, ` +
      `messages=${JSON.stringify(txn.messages || [])}`
    );
  }

  return {
    transactionId: txn.object_id,
    trackingNumber: txn.tracking_number,
    trackingUrl: txn.tracking_url_provider,
    labelUrl: txn.label_url,
    carrier: txn.rate?.provider || '',
    service: txn.rate?.servicelevel?.name || txn.rate?.servicelevel?.token || '',
    serviceToken: txn.rate?.servicelevel?.token || '',
  };
}

/**
 * Register a webhook for tracking updates (called once during setup).
 * In practice you configure this in the Shippo dashboard, not via API.
 * Left here for reference.
 */
async function registerTrackingWebhook(webhookUrl) {
  const res = await fetch(`${SHIPPO_API}/webhooks`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      url: webhookUrl,
      event: 'track_updated',
      is_test: process.env.NODE_ENV !== 'production',
    }),
  });
  return res.json();
}

module.exports = { createShipment, purchaseLabel, registerTrackingWebhook };
