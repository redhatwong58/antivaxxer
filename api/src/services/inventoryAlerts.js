/**
 * Inventory Alert Service — ANTIVAXXER
 *
 * [AV-033] feat: inventory alerts (warning + reorder thresholds)
 *
 * Sends email alerts when variant stock drops below configured thresholds.
 * Called from the webhook handler AFTER successful order creation.
 *
 * CRITICAL DESIGN DECISIONS:
 * 1. This service is fire-and-forget. It NEVER throws to the caller.
 *    If the alert fails, orders still complete normally.
 * 2. Own SES client (not shared with email.js). If someone refactors
 *    transactional email, alerts keep working independently.
 * 3. Deduplication: only alerts on the transition INTO a threshold zone.
 *    Won't re-alert if the variant was already below threshold before purchase.
 *
 * Thresholds (configurable via .env):
 *   INVENTORY_WARNING_THRESHOLD=15  (low stock — reorder soon)
 *   INVENTORY_REORDER_THRESHOLD=5   (critical — reorder now)
 *   INVENTORY_ALERT_EMAIL=ops@antivaxxer.com (recipient)
 */

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

const ses = new SESClient({ region: process.env.AWS_REGION || 'us-east-1' });

// Thresholds — configurable per .env, with apparel-standard defaults
const WARNING_THRESHOLD = parseInt(process.env.INVENTORY_WARNING_THRESHOLD || '15', 10);
const REORDER_THRESHOLD = parseInt(process.env.INVENTORY_REORDER_THRESHOLD || '5', 10);

/**
 * Check inventory levels after a purchase and send alerts if needed.
 *
 * @param {Array} purchasedItems — Array of { variantId, quantity, productName, colorName, sizeName, stockBefore, stockAfter }
 *
 * stockBefore/stockAfter allow deduplication:
 *   - If stockBefore was already below threshold, don't re-alert
 *   - Only alert on the transition INTO a threshold zone
 *
 * This function NEVER throws. All errors are caught and logged.
 */
async function checkInventoryLevels(purchasedItems) {
  const alertEmail = process.env.INVENTORY_ALERT_EMAIL;
  const fromEmail = process.env.SES_FROM_EMAIL;

  // If alerting is not configured, exit silently
  if (!alertEmail || !fromEmail) {
    return;
  }

  const warnings = [];  // Crossed below WARNING_THRESHOLD
  const critical = [];  // Crossed below REORDER_THRESHOLD

  for (const item of purchasedItems) {
    const { stockBefore, stockAfter, productName, colorName, sizeName, variantId } = item;
    const label = `${productName} — ${[colorName, sizeName].filter(Boolean).join(' / ')}`;

    // REORDER: crossed into critical zone (was above, now at or below)
    if (stockAfter <= REORDER_THRESHOLD && stockBefore > REORDER_THRESHOLD) {
      critical.push({ label, stockAfter, variantId });
    }
    // WARNING: crossed into warning zone (was above, now at or below)
    // Only if not already in critical (avoid double-listing)
    else if (stockAfter <= WARNING_THRESHOLD && stockBefore > WARNING_THRESHOLD) {
      warnings.push({ label, stockAfter, variantId });
    }
  }

  // Nothing crossed a threshold — exit
  if (warnings.length === 0 && critical.length === 0) {
    return;
  }

  try {
    await sendInventoryAlert(alertEmail, fromEmail, warnings, critical);
  } catch (error) {
    // Log but NEVER throw — order processing must not be affected
    console.error('[INVENTORY ALERT] Failed to send alert email:', error.message);
  }
}

/**
 * Compose and send the inventory alert email.
 * Combines warnings and critical items into a single email.
 */
async function sendInventoryAlert(to, from, warnings, critical) {
  const hasCritical = critical.length > 0;
  const subject = hasCritical
    ? `⚠️ REORDER NOW — ${critical.length} variant${critical.length > 1 ? 's' : ''} critically low`
    : `Low Stock Alert — ${warnings.length} variant${warnings.length > 1 ? 's' : ''} below threshold`;

  const criticalRows = critical.map((item) =>
    `<tr style="background:#3a0808;">
      <td style="padding:8px 12px;color:#ff6b6b;font-weight:bold;">${item.label}</td>
      <td style="padding:8px 12px;color:#ff6b6b;text-align:center;font-weight:bold;">${item.stockAfter}</td>
      <td style="padding:8px 12px;color:#ff6b6b;text-align:center;">REORDER NOW</td>
    </tr>`
  ).join('');

  const warningRows = warnings.map((item) =>
    `<tr>
      <td style="padding:8px 12px;color:#E8E5DD;">${item.label}</td>
      <td style="padding:8px 12px;color:#E8E5DD;text-align:center;">${item.stockAfter}</td>
      <td style="padding:8px 12px;color:#f0ad4e;text-align:center;">LOW STOCK</td>
    </tr>`
  ).join('');

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#0B0B0B;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #2C2F33;">
          <h1 style="font-size:24px;letter-spacing:8px;color:#E8E5DD;margin:0;font-weight:300;">ANTIVAXXER</h1>
          <p style="color:#888;font-size:11px;letter-spacing:3px;margin:8px 0 0 0;">INVENTORY ALERT</p>
        </div>
        <div style="padding:24px 0;">
          <table style="width:100%;border-collapse:collapse;border:1px solid #2C2F33;">
            <thead>
              <tr style="background:#1a1a1a;">
                <th style="padding:10px 12px;text-align:left;color:#888;font-size:10px;letter-spacing:2px;">VARIANT</th>
                <th style="padding:10px 12px;text-align:center;color:#888;font-size:10px;letter-spacing:2px;">QTY</th>
                <th style="padding:10px 12px;text-align:center;color:#888;font-size:10px;letter-spacing:2px;">STATUS</th>
              </tr>
            </thead>
            <tbody>
              ${criticalRows}${warningRows}
            </tbody>
          </table>
          <p style="color:#555;font-size:11px;margin:16px 0 0 0;">
            Warning threshold: ${WARNING_THRESHOLD} units &nbsp;|&nbsp; Reorder threshold: ${REORDER_THRESHOLD} units
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = [
    'ANTIVAXXER — Inventory Alert',
    '',
    ...critical.map((i) => `🔴 REORDER NOW: ${i.label} — ${i.stockAfter} remaining`),
    ...warnings.map((i) => `🟡 LOW STOCK: ${i.label} — ${i.stockAfter} remaining`),
    '',
    `Warning threshold: ${WARNING_THRESHOLD} | Reorder threshold: ${REORDER_THRESHOLD}`,
  ].join('\n');

  await ses.send(
    new SendEmailCommand({
      Source: from,
      Destination: { ToAddresses: [to] },
      Message: {
        Subject: { Data: subject, Charset: 'UTF-8' },
        Body: {
          Html: { Data: htmlBody, Charset: 'UTF-8' },
          Text: { Data: textBody, Charset: 'UTF-8' },
        },
      },
    })
  );

  console.log(`[INVENTORY ALERT] Sent: ${critical.length} critical, ${warnings.length} warnings`);
}

module.exports = { checkInventoryLevels, WARNING_THRESHOLD, REORDER_THRESHOLD };
