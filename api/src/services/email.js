/**
 * Email Service — AWS SES
 *
 * [AV-014] feat: order confirmation email via SES
 *
 * Sends transactional emails using AWS SES.
 * Graceful failure: if email fails, the calling code continues.
 * Orders are never blocked by email errors.
 *
 * Requires in .env:
 *   AWS_REGION (defaults to us-east-1)
 *   SES_FROM_EMAIL (must be verified in SES)
 *
 * Credentials: SDK auto-detects from instance role (App Runner, EC2, Lambda).
 * For local dev, use AWS_ACCESS_KEY_ID + AWS_SECRET_ACCESS_KEY in .env or
 * an `aws configure` profile. Never set explicit keys in production.
 */

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses');

// [AV-067] v5.4.8 — optional SES_ENDPOINT routes to a local aws-ses-v2-local
// instance for offline dev. Production leaves this unset and hits real SES.
const sesConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
};
if (process.env.SES_ENDPOINT) {
  sesConfig.endpoint = process.env.SES_ENDPOINT;
  // Local SES mock doesn't validate AWS credentials but the SDK still requires them
  sesConfig.credentials = { accessKeyId: 'local', secretAccessKey: 'local' };
  console.log(`[EMAIL] Using local SES mock at ${process.env.SES_ENDPOINT}`);
}
const ses = new SESClient(sesConfig);

/**
 * Send order confirmation email.
 * @param {Object} order - Order with items included
 */
async function sendOrderConfirmation(order) {
  const fromEmail = process.env.SES_FROM_EMAIL;
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://antivaxxer.com';

  if (!fromEmail) {
    console.warn('[EMAIL] SES_FROM_EMAIL not configured. Skipping confirmation email.');
    return;
  }

  const itemRows = (order.items || [])
    .map(
      (item) =>
        `<tr>
          <td style="padding:8px 12px;border-bottom:1px solid #2C2F33;color:#E8E5DD;font-size:14px;">
            ${item.productName}
            <br><span style="color:#888;font-size:12px;">${[item.colorName, item.sizeName].filter(Boolean).join(' / ')} · ${item.sku}</span>
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #2C2F33;color:#E8E5DD;text-align:center;font-size:14px;">
            ${item.quantity}
          </td>
          <td style="padding:8px 12px;border-bottom:1px solid #2C2F33;color:#E8E5DD;text-align:right;font-size:14px;">
            $${Number(item.unitPrice).toFixed(2)}
          </td>
        </tr>`
    )
    .join('');

  const shippingAddr = order.shippingAddress || {};
  const addressBlock = shippingAddr.firstName
    ? `${shippingAddr.firstName} ${shippingAddr.lastName}<br>
       ${shippingAddr.line1}${shippingAddr.line2 ? '<br>' + shippingAddr.line2 : ''}<br>
       ${shippingAddr.city}, ${shippingAddr.state} ${shippingAddr.zip}`
    : 'Not provided';

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#0B0B0B;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <!-- Header -->
        <div style="text-align:center;padding-bottom:32px;border-bottom:1px solid #2C2F33;">
          <h1 style="font-size:28px;letter-spacing:8px;color:#E8E5DD;margin:0;font-weight:300;">
            ANTIVAXXER
          </h1>
        </div>

        <!-- Confirmation -->
        <div style="text-align:center;padding:32px 0;">
          <h2 style="font-size:20px;letter-spacing:4px;color:#E8E5DD;margin:0 0 8px 0;font-weight:300;">
            ORDER CONFIRMED
          </h2>
          <p style="color:#888;font-size:14px;margin:0;">
            Order ${order.orderNumber}
          </p>
        </div>

        <!-- Items -->
        <table style="width:100%;border-collapse:collapse;margin-bottom:24px;">
          <thead>
            <tr style="border-bottom:2px solid #2C2F33;">
              <th style="padding:8px 12px;text-align:left;color:#888;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:400;">Item</th>
              <th style="padding:8px 12px;text-align:center;color:#888;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:400;">Qty</th>
              <th style="padding:8px 12px;text-align:right;color:#888;font-size:11px;letter-spacing:2px;text-transform:uppercase;font-weight:400;">Price</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>

        <!-- Totals -->
        <div style="border-top:1px solid #2C2F33;padding-top:16px;margin-bottom:32px;">
          <table style="width:100%;font-size:14px;">
            <tr>
              <td style="padding:4px 12px;color:#888;">Subtotal</td>
              <td style="padding:4px 12px;text-align:right;color:#E8E5DD;">$${Number(order.subtotal).toFixed(2)}</td>
            </tr>
            ${Number(order.discountAmount) > 0 ? `<tr>
              <td style="padding:4px 12px;color:#888;">Discount${order.promoCode ? ' (' + order.promoCode + ')' : ''}</td>
              <td style="padding:4px 12px;text-align:right;color:#88C988;">-$${Number(order.discountAmount).toFixed(2)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding:4px 12px;color:#888;">Shipping</td>
              <td style="padding:4px 12px;text-align:right;color:#E8E5DD;">
                ${Number(order.shippingAmount) === 0 ? 'FREE' : '$' + Number(order.shippingAmount).toFixed(2)}
              </td>
            </tr>
            <tr>
              <td style="padding:4px 12px;color:#888;">Tax</td>
              <td style="padding:4px 12px;text-align:right;color:#E8E5DD;">
                ${Number(order.taxAmount) === 0 ? '—' : '$' + Number(order.taxAmount).toFixed(2)}
              </td>
            </tr>
            <tr style="border-top:1px solid #2C2F33;">
              <td style="padding:12px;color:#E8E5DD;font-size:16px;">Total</td>
              <td style="padding:12px;text-align:right;color:#E8E5DD;font-size:16px;font-weight:600;">
                $${Number(order.total).toFixed(2)}
              </td>
            </tr>
          </table>
        </div>

        <!-- Shipping Address -->
        <div style="margin-bottom:32px;">
          <h3 style="font-size:11px;letter-spacing:3px;text-transform:uppercase;color:#888;margin:0 0 8px 0;font-weight:400;">
            Shipping To
          </h3>
          <p style="color:#E8E5DD;font-size:14px;line-height:1.6;margin:0;">
            ${addressBlock}
          </p>
        </div>

        <!-- Continue Shopping CTA -->
        <div style="text-align:center;padding:24px 0 16px 0;">
          <a href="${siteUrl}/shop"
             style="display:inline-block;padding:14px 40px;background:#6A0E0E;color:#E8E5DD;
                    text-decoration:none;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
            Continue Shopping
          </a>
        </div>

        <!-- Footer -->
        <div style="border-top:1px solid #2C2F33;padding-top:24px;text-align:center;">
          <p style="color:#888;font-size:12px;margin:0 0 8px 0;">
            You will receive tracking information once your order ships.
          </p>
          <p style="color:#555;font-size:11px;margin:0;">
            Questions? Reply to this email or contact support@antivaxxer.com
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = `
ANTIVAXXER — Order Confirmed

Order: ${order.orderNumber}
Email: ${order.email}
${Number(order.discountAmount) > 0 ? `Discount: -$${Number(order.discountAmount).toFixed(2)}${order.promoCode ? ' (' + order.promoCode + ')' : ''}\n` : ''}Total: $${Number(order.total).toFixed(2)}

You will receive tracking information once your order ships.

Continue shopping: ${siteUrl}/shop
  `.trim();

  try {
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [order.email] },
        ReplyToAddresses: [process.env.SES_REPLY_TO_EMAIL || fromEmail],
        Message: {
          Subject: { Data: `Order Confirmed — ${order.orderNumber}`, Charset: 'UTF-8' },
          Body: {
            Html: { Data: htmlBody, Charset: 'UTF-8' },
            Text: { Data: textBody, Charset: 'UTF-8' },
          },
        },
      })
    );

    console.log(`[EMAIL] Confirmation sent to ${order.email} for ${order.orderNumber}`);
  } catch (error) {
    // Log but don't throw — email failure should never block order processing
    console.error(`[EMAIL] Failed to send confirmation to ${order.email}:`, error.message);
  }
}


/**
 * Send abandoned cart recovery email.
 * @param {Object} cart — AbandonedCart record with cartData
 */
async function sendAbandonedCartEmail(cart) {
  const fromEmail = process.env.SES_FROM_EMAIL;
  if (!fromEmail) {
    console.warn('[EMAIL] SES_FROM_EMAIL not configured. Skipping abandoned cart email.');
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://antivaxxer.com';
  const recoveryUrl = `${siteUrl}/cart/recover?token=${cart.recoveryToken}`;

  // Parse cart items defensively — cartData is user-submitted JSON
  const cartItems = Array.isArray(cart.cartData) ? cart.cartData : [];
  const itemRowsHtml = cartItems.map((item) => `
    <tr>
      <td style="padding:8px 12px;border-bottom:1px solid #2C2F33;color:#E8E5DD;font-size:13px;">
        ${item.name || 'Product'}
        <br><span style="color:#888;font-size:11px;">${[item.color, item.size].filter(Boolean).join(' / ')}</span>
      </td>
      <td style="padding:8px 12px;border-bottom:1px solid #2C2F33;color:#E8E5DD;text-align:center;font-size:13px;">${item.qty || 1}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #2C2F33;color:#E8E5DD;text-align:right;font-size:13px;">$${Number(item.price || 0).toFixed(2)}</td>
    </tr>`).join('');

  const cartTableHtml = cartItems.length > 0 ? `
        <table style="width:100%;border-collapse:collapse;margin:0 0 24px 0;">
          <thead>
            <tr style="border-bottom:1px solid #2C2F33;">
              <th style="padding:6px 12px;text-align:left;color:#888;font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:400;">Item</th>
              <th style="padding:6px 12px;text-align:center;color:#888;font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:400;">Qty</th>
              <th style="padding:6px 12px;text-align:right;color:#888;font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:400;">Price</th>
            </tr>
          </thead>
          <tbody>${itemRowsHtml}</tbody>
        </table>` : '';

  const cartItemsText = cartItems.length > 0
    ? '\nYour items:\n' + cartItems.map((item) =>
        `  ${item.qty || 1}× ${item.name || 'Product'} ${[item.color, item.size].filter(Boolean).join('/')} — $${Number(item.price || 0).toFixed(2)}`
      ).join('\n') + '\n'
    : '';

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#0B0B0B;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;padding-bottom:32px;border-bottom:1px solid #2C2F33;">
          <h1 style="font-size:28px;letter-spacing:8px;color:#E8E5DD;margin:0;font-weight:300;">ANTIVAXXER</h1>
        </div>
        <div style="text-align:center;padding:32px 0 16px 0;">
          <h2 style="font-size:20px;letter-spacing:4px;color:#E8E5DD;margin:0 0 12px 0;font-weight:300;">YOU LEFT SOMETHING BEHIND</h2>
          <p style="color:#888;font-size:14px;line-height:1.7;margin:0 0 24px 0;">
            Looks like you didn't finish checking out. Your items are still waiting for you.
          </p>
        </div>
        ${cartTableHtml}
        <div style="text-align:center;padding:8px 0 24px 0;">
          <a href="${recoveryUrl}" style="display:inline-block;padding:14px 32px;background:#6A0E0E;color:#E8E5DD;text-decoration:none;font-size:12px;letter-spacing:3px;text-transform:uppercase;">
            Complete Your Order
          </a>
        </div>
        <div style="border-top:1px solid #2C2F33;padding-top:24px;text-align:center;">
          <p style="color:#555;font-size:11px;margin:0;">If you didn't start this order, you can safely ignore this email.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  try {
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [cart.email] },
        Message: {
          Subject: { Data: 'You left something behind — ANTIVAXXER', Charset: 'UTF-8' },
          Body: {
            Html: { Data: htmlBody, Charset: 'UTF-8' },
            Text: { Data: `You left items in your cart.${cartItemsText}\nComplete your order: ${recoveryUrl}`, Charset: 'UTF-8' },
          },
        },
      })
    );
  } catch (error) {
    console.error(`[EMAIL] Abandoned cart email failed for ${cart.email}:`, error.message);
  }
}

/**
 * Send password reset email.
 * [AV-049] v5.3.5 — emailed when a user requests a password reset.
 * The raw token is in the URL only — never logged, never stored
 * (we store SHA-256 of it in users.reset_token_hash).
 *
 * @param {Object} params
 * @param {string} params.email — recipient
 * @param {string} params.name — user display name
 * @param {string} params.resetUrl — full URL with token (e.g. https://site/account/reset-password/abc123)
 */
async function sendPasswordResetEmail({ email, name, resetUrl }) {
  const fromEmail = process.env.SES_FROM_EMAIL;
  if (!fromEmail) {
    console.warn('[EMAIL] SES_FROM_EMAIL not configured. Skipping password reset email.');
    return;
  }

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#0B0B0B;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;padding-bottom:32px;border-bottom:1px solid #2C2F33;">
          <h1 style="font-size:28px;letter-spacing:8px;color:#E8E5DD;margin:0;font-weight:300;">ANTIVAXXER</h1>
        </div>
        <div style="padding:32px 0;">
          <h2 style="font-size:20px;letter-spacing:4px;color:#E8E5DD;margin:0 0 16px 0;font-weight:300;text-align:center;">RESET YOUR PASSWORD</h2>
          <p style="color:#B0B0B0;font-size:14px;line-height:1.7;margin:0 0 12px 0;">
            Hi ${name || 'there'},
          </p>
          <p style="color:#B0B0B0;font-size:14px;line-height:1.7;margin:0 0 24px 0;">
            We received a request to reset your password. Click the button below to choose a new one.
            This link expires in <strong style="color:#E8E5DD;">1 hour</strong>.
          </p>
          <div style="text-align:center;margin:32px 0;">
            <a href="${resetUrl}" style="display:inline-block;padding:14px 40px;background:#6A0E0E;color:#E8E5DD;text-decoration:none;font-size:12px;letter-spacing:3px;text-transform:uppercase;">
              Reset Password
            </a>
          </div>
          <p style="color:#888;font-size:12px;line-height:1.6;margin:24px 0 0 0;">
            Or copy and paste this link into your browser:<br>
            <span style="color:#6A0E0E;word-break:break-all;">${resetUrl}</span>
          </p>
        </div>
        <div style="border-top:1px solid #2C2F33;padding-top:24px;text-align:center;">
          <p style="color:#555;font-size:11px;margin:0;line-height:1.6;">
            If you didn't request a password reset, you can safely ignore this email.<br>
            Your password won't change unless you click the link above.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = `
ANTIVAXXER — Reset Your Password

Hi ${name || 'there'},

We received a request to reset your password. Open this link to choose a new one:

${resetUrl}

This link expires in 1 hour.

If you didn't request a password reset, you can safely ignore this email.
  `.trim();

  try {
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [email] },
        ReplyToAddresses: [process.env.SES_REPLY_TO_EMAIL || fromEmail],
        Message: {
          Subject: { Data: 'Reset your ANTIVAXXER password', Charset: 'UTF-8' },
          Body: {
            Html: { Data: htmlBody, Charset: 'UTF-8' },
            Text: { Data: textBody, Charset: 'UTF-8' },
          },
        },
      })
    );
    console.log(`[EMAIL] Password reset link sent to ${email}`);
  } catch (error) {
    // Re-throw — the auth route needs to know if email failed so it can
    // log it; user still gets a generic success response so we don't leak
    // which addresses are registered.
    console.error(`[EMAIL] Password reset email failed for ${email}:`, error.message);
    throw error;
  }
}

/**
 * Send per-order fulfillment email to ops.
 * [AV-055] v5.3.8 — fires on every successful Stripe payment, after
 *   inventory deduction. Sent to INVENTORY_ALERT_EMAIL (defaults to
 *   contact@antivaxxer.com). Includes everything ops needs to fulfill
 *   the order in one place: order number, customer info, line items
 *   with SKUs, shipping address, and the inventory snapshot AFTER
 *   deduction (so they can see at-a-glance which SKUs are running low
 *   and need restocking).
 *
 * @param {Object} params
 * @param {Object} params.order — full order with items
 * @param {Array} params.inventoryChanges — [{ variantId, productName, colorName,
 *   sizeName, quantity, stockBefore, stockAfter }] from the webhook handler
 */
async function sendFulfillmentEmail({ order, inventoryChanges }) {
  const fromEmail = process.env.SES_FROM_EMAIL;
  const opsEmail = process.env.INVENTORY_ALERT_EMAIL || 'contact@antivaxxer.com';
  if (!fromEmail) {
    console.warn('[EMAIL] SES_FROM_EMAIL not configured. Skipping fulfillment email.');
    return;
  }

  const itemRowsHtml = order.items
    .map((item) => {
      const inv = inventoryChanges.find((c) => c.variantId === item.variantId);
      const stockNote = inv
        ? `<span style="color:${inv.stockAfter <= 5 ? '#FF6666' : inv.stockAfter <= 15 ? '#FFB347' : '#88C988'};">${inv.stockAfter} left</span>`
        : '<span style="color:#888;">—</span>';
      return `
        <tr style="border-bottom:1px solid #2C2F33;">
          <td style="padding:10px 8px;color:#E8E5DD;font-size:13px;">${item.productName}<br>
            <span style="color:#888;font-size:11px;">${[item.colorName, item.sizeName].filter(Boolean).join(' / ')}</span>
          </td>
          <td style="padding:10px 8px;color:#888;font-family:monospace;font-size:11px;">${item.sku}</td>
          <td style="padding:10px 8px;color:#E8E5DD;text-align:center;font-size:13px;">${item.quantity}</td>
          <td style="padding:10px 8px;font-size:11px;text-align:right;">${stockNote}</td>
        </tr>`;
    })
    .join('');

  const addr = order.shippingAddress || {};
  const addrHtml = addr.firstName
    ? `${addr.firstName} ${addr.lastName}<br>
       ${addr.line1}${addr.line2 ? '<br>' + addr.line2 : ''}<br>
       ${addr.city}, ${addr.state} ${addr.zip}<br>
       ${addr.country || 'US'}`
    : '<em style="color:#888;">No shipping address</em>';

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#0B0B0B;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#E8E5DD;">
      <div style="max-width:680px;margin:0 auto;padding:32px 20px;">
        <div style="border-bottom:2px solid #6A0E0E;padding-bottom:16px;margin-bottom:24px;">
          <h1 style="font-size:24px;letter-spacing:4px;color:#E8E5DD;margin:0;font-weight:300;">NEW ORDER</h1>
          <p style="color:#888;font-size:12px;margin:4px 0 0 0;">${order.orderNumber} · ${new Date(order.createdAt).toLocaleString()}</p>
        </div>

        <table width="100%" style="margin-bottom:24px;">
          <tr>
            <td style="vertical-align:top;width:50%;padding-right:12px;">
              <p style="color:#888;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px 0;">Customer</p>
              <p style="color:#E8E5DD;font-size:13px;margin:0;">${order.email}</p>
            </td>
            <td style="vertical-align:top;width:50%;padding-left:12px;">
              <p style="color:#888;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin:0 0 6px 0;">Ship to</p>
              <p style="color:#E8E5DD;font-size:12px;line-height:1.5;margin:0;">${addrHtml}</p>
            </td>
          </tr>
        </table>

        <p style="color:#888;font-size:10px;letter-spacing:2px;text-transform:uppercase;margin:0 0 8px 0;">Items</p>
        <table width="100%" style="border-top:1px solid #2C2F33;margin-bottom:24px;">
          <thead>
            <tr style="border-bottom:1px solid #2C2F33;">
              <th style="padding:8px;text-align:left;color:#888;font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:300;">Product</th>
              <th style="padding:8px;text-align:left;color:#888;font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:300;">SKU</th>
              <th style="padding:8px;text-align:center;color:#888;font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:300;">Qty</th>
              <th style="padding:8px;text-align:right;color:#888;font-size:10px;letter-spacing:1px;text-transform:uppercase;font-weight:300;">Stock After</th>
            </tr>
          </thead>
          <tbody>${itemRowsHtml}</tbody>
        </table>

        <table width="100%" style="border-top:1px solid #2C2F33;padding-top:12px;">
          <tr>
            <td style="color:#888;font-size:12px;text-align:right;padding:4px 8px;">Subtotal</td>
            <td style="color:#E8E5DD;font-size:13px;text-align:right;padding:4px 8px;width:100px;">$${Number(order.subtotal).toFixed(2)}</td>
          </tr>
          ${Number(order.discountAmount) > 0 ? `<tr>
            <td style="color:#888;font-size:12px;text-align:right;padding:4px 8px;">Discount${order.promoCode ? ' (' + order.promoCode + ')' : ''}</td>
            <td style="color:#88C988;font-size:13px;text-align:right;padding:4px 8px;">-$${Number(order.discountAmount).toFixed(2)}</td>
          </tr>` : ''}
          <tr>
            <td style="color:#888;font-size:12px;text-align:right;padding:4px 8px;">Shipping</td>
            <td style="color:#E8E5DD;font-size:13px;text-align:right;padding:4px 8px;">${Number(order.shippingAmount) === 0 ? 'FREE' : '$' + Number(order.shippingAmount).toFixed(2)}</td>
          </tr>
          <tr>
            <td style="color:#888;font-size:12px;text-align:right;padding:4px 8px;">Tax</td>
            <td style="color:#E8E5DD;font-size:13px;text-align:right;padding:4px 8px;">${Number(order.taxAmount) === 0 ? '—' : '$' + Number(order.taxAmount).toFixed(2)}</td>
          </tr>
          <tr style="border-top:1px solid #2C2F33;">
            <td style="color:#E8E5DD;font-size:14px;text-align:right;padding:8px;font-weight:bold;">TOTAL</td>
            <td style="color:#E8E5DD;font-size:16px;text-align:right;padding:8px;font-family:'Bebas Neue',sans-serif;letter-spacing:2px;">$${Number(order.total).toFixed(2)}</td>
          </tr>
        </table>

        <div style="margin-top:32px;padding-top:16px;border-top:1px solid #2C2F33;">
          <p style="color:#888;font-size:11px;line-height:1.6;margin:0;">
            Inventory was already deducted when payment cleared.
            Open this order in admin to print labels and update tracking:<br>
            <a href="${process.env.NEXT_PUBLIC_SITE_URL || 'https://antivaxxer.com'}/admin/orders/${order.id}" style="color:#6A0E0E;">View order in admin →</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = `
NEW ORDER — ${order.orderNumber}
${new Date(order.createdAt).toLocaleString()}

Customer: ${order.email}

Ship to:
${addr.firstName ? `${addr.firstName} ${addr.lastName}\n${addr.line1}${addr.line2 ? '\n' + addr.line2 : ''}\n${addr.city}, ${addr.state} ${addr.zip}\n${addr.country || 'US'}` : '(no shipping address)'}

Items:
${order.items.map((item) => {
  const inv = inventoryChanges.find((c) => c.variantId === item.variantId);
  return `  ${item.quantity}× ${item.productName} ${[item.colorName, item.sizeName].filter(Boolean).join('/')} [${item.sku}] — ${inv ? inv.stockAfter + ' left' : ''}`;
}).join('\n')}

Subtotal: $${Number(order.subtotal).toFixed(2)}
${Number(order.discountAmount) > 0 ? `Discount: -$${Number(order.discountAmount).toFixed(2)}${order.promoCode ? ' (' + order.promoCode + ')' : ''}\n` : ''}Shipping: ${Number(order.shippingAmount) === 0 ? 'FREE' : '$' + Number(order.shippingAmount).toFixed(2)}
Tax:      ${Number(order.taxAmount) === 0 ? '-' : '$' + Number(order.taxAmount).toFixed(2)}
TOTAL:    $${Number(order.total).toFixed(2)}

View in admin: ${process.env.NEXT_PUBLIC_SITE_URL || 'https://antivaxxer.com'}/admin/orders/${order.id}
  `.trim();

  try {
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [opsEmail] },
        ReplyToAddresses: [process.env.SES_REPLY_TO_EMAIL || fromEmail],
        Message: {
          Subject: { Data: `[NEW ORDER] ${order.orderNumber} — $${Number(order.total).toFixed(2)}`, Charset: 'UTF-8' },
          Body: {
            Html: { Data: htmlBody, Charset: 'UTF-8' },
            Text: { Data: textBody, Charset: 'UTF-8' },
          },
        },
      })
    );
    console.log(`[EMAIL] Fulfillment notification sent to ${opsEmail} for order ${order.orderNumber}`);
  } catch (error) {
    console.error(`[EMAIL] Fulfillment email failed for ${order.orderNumber}:`, error.message);
    // Re-throw so the webhook can log it — fulfillment email is non-critical,
    // the order is already paid and confirmed regardless.
    throw error;
  }
}

/**
 * Send admin alert when a webhook handler fails.
 * [AV-057] v5.3.9 — fires whenever the Stripe webhook handler crashes,
 *   so failures don't rot in console logs. Sent to INVENTORY_ALERT_EMAIL
 *   (same inbox as fulfillment emails). The event is also written to
 *   the FailedWebhook DLQ so ops can retry from /admin/failed-webhooks.
 *
 * @param {Object} params
 * @param {string} params.eventType — e.g. 'payment_intent.succeeded'
 * @param {string} params.eventId — Stripe event ID (evt_xxx)
 * @param {string} params.errorMessage — the exception message
 */
async function sendWebhookFailureAlert({ eventType, eventId, errorMessage }) {
  const fromEmail = process.env.SES_FROM_EMAIL;
  const opsEmail = process.env.INVENTORY_ALERT_EMAIL || 'contact@antivaxxer.com';
  if (!fromEmail) {
    console.warn('[EMAIL] SES_FROM_EMAIL not configured. Skipping webhook failure alert.');
    return;
  }

  const adminUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'https://antivaxxer.com'}/admin/failed-webhooks`;

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#0B0B0B;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;color:#E8E5DD;">
      <div style="max-width:600px;margin:0 auto;padding:32px 20px;">
        <div style="border-bottom:2px solid #6A0E0E;padding-bottom:12px;margin-bottom:20px;">
          <h1 style="font-size:22px;letter-spacing:3px;color:#FF6666;margin:0;font-weight:300;">⚠ WEBHOOK FAILURE</h1>
          <p style="color:#888;font-size:11px;margin:4px 0 0 0;">${new Date().toISOString()}</p>
        </div>

        <p style="color:#E8E5DD;font-size:14px;line-height:1.6;margin:0 0 16px 0;">
          A Stripe webhook event failed during processing. The event has been written to the
          dead-letter queue and can be retried from the admin panel.
        </p>

        <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
          <tr><td style="padding:6px 0;color:#888;font-size:11px;letter-spacing:1px;text-transform:uppercase;width:120px;">Event type</td><td style="color:#E8E5DD;font-family:monospace;font-size:12px;">${eventType}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:11px;letter-spacing:1px;text-transform:uppercase;">Event ID</td><td style="color:#E8E5DD;font-family:monospace;font-size:12px;">${eventId}</td></tr>
          <tr><td style="padding:6px 0;color:#888;font-size:11px;letter-spacing:1px;text-transform:uppercase;vertical-align:top;">Error</td><td style="color:#FF6666;font-family:monospace;font-size:12px;">${errorMessage}</td></tr>
        </table>

        <div style="padding:12px;background:#2C2F33;border-left:3px solid #FFB347;margin-bottom:20px;">
          <p style="color:#FFB347;font-size:12px;margin:0 0 6px 0;font-weight:bold;">⚠ IMMEDIATE ACTION REQUIRED</p>
          <p style="color:#E8E5DD;font-size:11px;line-height:1.5;margin:0;">
            If this was a <strong>payment_intent.succeeded</strong> event, the customer has been charged
            but the order may not be in processing state. Inventory may not have been deducted.
            Review the order in the DLQ and retry manually.
          </p>
        </div>

        <div style="text-align:center;margin:24px 0;">
          <a href="${adminUrl}" style="display:inline-block;padding:12px 32px;background:#6A0E0E;color:#E8E5DD;text-decoration:none;font-size:11px;letter-spacing:2px;text-transform:uppercase;">
            View Dead-Letter Queue →
          </a>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = `
⚠ WEBHOOK FAILURE — ${new Date().toISOString()}

A Stripe webhook event failed during processing. The event has been
written to the dead-letter queue and can be retried from the admin panel.

Event type:  ${eventType}
Event ID:    ${eventId}
Error:       ${errorMessage}

⚠ IMMEDIATE ACTION REQUIRED:
If this was a payment_intent.succeeded event, the customer has been
charged but the order may not be in processing state. Inventory may not
have been deducted. Review the order in the DLQ and retry manually.

View DLQ: ${adminUrl}
  `.trim();

  try {
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [opsEmail] },
        ReplyToAddresses: [process.env.SES_REPLY_TO_EMAIL || fromEmail],
        Message: {
          Subject: { Data: `[WEBHOOK FAILURE] ${eventType} — ${eventId}`, Charset: 'UTF-8' },
          Body: {
            Html: { Data: htmlBody, Charset: 'UTF-8' },
            Text: { Data: textBody, Charset: 'UTF-8' },
          },
        },
      })
    );
    console.log(`[EMAIL] Webhook failure alert sent to ${opsEmail} for event ${eventId}`);
  } catch (error) {
    console.error(`[EMAIL] Webhook failure alert failed for event ${eventId}:`, error.message);
    // Don't re-throw — we're already in a failure path, don't cascade
  }
}

// ============================================================
// [AV-060] v5.4.1 — WELCOME EMAIL
// ============================================================
// Sent after successful registration. Branded, short, links to shop.
// Fire-and-forget: if it fails, the registration itself still succeeded.

async function sendWelcomeEmail({ email, name }) {
  const fromEmail = process.env.SES_FROM_EMAIL;
  if (!fromEmail) {
    console.warn('[EMAIL] SES_FROM_EMAIL not configured. Skipping welcome email.');
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://antivaxxer.com';
  const firstName = (name || '').split(' ')[0] || 'there';

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#0B0B0B;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;padding-bottom:32px;border-bottom:1px solid #2C2F33;">
          <h1 style="font-size:28px;letter-spacing:8px;color:#E8E5DD;margin:0;font-weight:300;">ANTIVAXXER</h1>
        </div>
        <div style="text-align:center;padding:40px 0 24px 0;">
          <h2 style="font-size:22px;letter-spacing:4px;color:#E8E5DD;margin:0 0 16px 0;font-weight:300;">
            WELCOME, ${firstName.toUpperCase()}
          </h2>
          <p style="color:#888;font-size:14px;line-height:1.7;margin:0 0 24px 0;">
            Your account is live. You now have access to your wishlist,
            order tracking, and early access to future drops.
          </p>
        </div>
        <div style="text-align:center;padding-bottom:32px;">
          <a href="${siteUrl}/shop" style="display:inline-block;padding:14px 40px;background:#6A0E0E;color:#E8E5DD;
             text-decoration:none;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
            Start Shopping
          </a>
        </div>
        <div style="text-align:center;padding:16px 0 24px 0;border-top:1px solid #2C2F33;">
          <p style="color:#888;font-size:12px;letter-spacing:1px;text-transform:uppercase;margin:0 0 8px 0;">
            Your first-order code
          </p>
          <p style="font-size:24px;letter-spacing:6px;color:#E8E5DD;font-weight:300;margin:0;">
            WELCOME10
          </p>
          <p style="color:#888;font-size:12px;margin:8px 0 0 0;">
            10% off your first purchase
          </p>
        </div>
        <div style="border-top:1px solid #2C2F33;padding-top:24px;text-align:center;">
          <p style="color:#555;font-size:11px;letter-spacing:1px;">
            Questions? Reply to this email or visit <a href="${siteUrl}" style="color:#6A0E0E;text-decoration:none;">antivaxxer.com</a>
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = `Welcome to ANTIVAXXER, ${firstName}!\n\nYour account is live. You now have access to your wishlist, order tracking, and early access to future drops.\n\nYour first-order code: WELCOME10 — 10% off your first purchase\n\nStart shopping: ${siteUrl}/shop`;

  try {
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [email] },
        ReplyToAddresses: [process.env.SES_REPLY_TO_EMAIL || fromEmail],
        Message: {
          Subject: { Data: `Welcome to ANTIVAXXER`, Charset: 'UTF-8' },
          Body: {
            Html: { Data: htmlBody, Charset: 'UTF-8' },
            Text: { Data: textBody, Charset: 'UTF-8' },
          },
        },
      })
    );
    console.log(`[EMAIL] Welcome email sent to ${email}`);
  } catch (error) {
    console.error(`[EMAIL] Welcome email failed for ${email}:`, error.message);
  }
}

// ============================================================
// [AV-060] v5.4.1 — SHIPPING NOTIFICATION EMAIL
// ============================================================
// Sent to the customer when their order transitions to "shipped".
// Includes tracking number + link, carrier info, and order summary.
// Triggered from two places: Shippo label purchase + manual status change.

async function sendShippingNotification(order) {
  const fromEmail = process.env.SES_FROM_EMAIL;
  if (!fromEmail) {
    console.warn('[EMAIL] SES_FROM_EMAIL not configured. Skipping shipping notification.');
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://antivaxxer.com';
  const trackingLink = order.trackingUrl
    ? `<a href="${order.trackingUrl}" style="color:#6A0E0E;text-decoration:none;font-family:monospace;font-size:14px;">${order.trackingNumber}</a>`
    : `<span style="font-family:monospace;font-size:14px;color:#E8E5DD;">${order.trackingNumber || 'Pending'}</span>`;

  const carrierLine = [order.carrier, order.carrierService].filter(Boolean).join(' · ') || 'Standard Shipping';

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#0B0B0B;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;padding-bottom:32px;border-bottom:1px solid #2C2F33;">
          <h1 style="font-size:28px;letter-spacing:8px;color:#E8E5DD;margin:0;font-weight:300;">ANTIVAXXER</h1>
        </div>

        <div style="text-align:center;padding:32px 0;">
          <h2 style="font-size:20px;letter-spacing:4px;color:#E8E5DD;margin:0 0 8px 0;font-weight:300;">
            YOUR ORDER HAS SHIPPED
          </h2>
          <p style="color:#888;font-size:14px;margin:0;">
            Order ${order.orderNumber}
          </p>
        </div>

        <div style="background:#1A1A1A;padding:20px;margin-bottom:24px;">
          <table style="width:100%;font-size:13px;">
            <tr>
              <td style="padding:6px 0;color:#888;letter-spacing:1px;text-transform:uppercase;font-size:10px;width:100px;">Carrier</td>
              <td style="color:#E8E5DD;">${carrierLine}</td>
            </tr>
            <tr>
              <td style="padding:6px 0;color:#888;letter-spacing:1px;text-transform:uppercase;font-size:10px;">Tracking</td>
              <td>${trackingLink}</td>
            </tr>
          </table>
        </div>

        <div style="text-align:center;margin-bottom:32px;">
          ${order.trackingUrl ? `
          <a href="${order.trackingUrl}" style="display:inline-block;padding:14px 40px;background:#6A0E0E;color:#E8E5DD;
             text-decoration:none;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
            Track Your Package
          </a>
          ` : ''}
        </div>

        <p style="color:#888;font-size:12px;line-height:1.6;text-align:center;margin:0 0 24px 0;">
          You'll receive another email when your package is delivered.
          ${order.userId ? `You can also track your order at <a href="${siteUrl}/account/orders" style="color:#6A0E0E;text-decoration:none;">My Orders</a>.` : ''}
        </p>

        <div style="border-top:1px solid #2C2F33;padding-top:24px;text-align:center;">
          <p style="color:#555;font-size:11px;letter-spacing:1px;">
            Questions about your order? Reply to this email.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = `YOUR ORDER HAS SHIPPED\n\nOrder ${order.orderNumber}\nCarrier: ${carrierLine}\nTracking: ${order.trackingNumber || 'Pending'}${order.trackingUrl ? '\nTrack: ' + order.trackingUrl : ''}\n\nYou'll receive another email when your package is delivered.`;

  try {
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [order.email] },
        ReplyToAddresses: [process.env.SES_REPLY_TO_EMAIL || fromEmail],
        Message: {
          Subject: { Data: `Your ANTIVAXXER order has shipped — ${order.orderNumber}`, Charset: 'UTF-8' },
          Body: {
            Html: { Data: htmlBody, Charset: 'UTF-8' },
            Text: { Data: textBody, Charset: 'UTF-8' },
          },
        },
      })
    );
    console.log(`[EMAIL] Shipping notification sent to ${order.email} for order ${order.orderNumber}`);
  } catch (error) {
    console.error(`[EMAIL] Shipping notification failed for order ${order.orderNumber}:`, error.message);
  }
}

// ============================================================
// [AV-060] v5.4.1 — DELIVERY CONFIRMATION EMAIL
// ============================================================
// Sent to the customer when Shippo tracking reports DELIVERED.
// Triggered from the Shippo webhook handler in webhooks.js.

async function sendDeliveryConfirmation(order) {
  const fromEmail = process.env.SES_FROM_EMAIL;
  if (!fromEmail) {
    console.warn('[EMAIL] SES_FROM_EMAIL not configured. Skipping delivery confirmation.');
    return;
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://antivaxxer.com';

  const htmlBody = `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8"></head>
    <body style="margin:0;padding:0;background:#0B0B0B;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;">
      <div style="max-width:600px;margin:0 auto;padding:40px 20px;">
        <div style="text-align:center;padding-bottom:32px;border-bottom:1px solid #2C2F33;">
          <h1 style="font-size:28px;letter-spacing:8px;color:#E8E5DD;margin:0;font-weight:300;">ANTIVAXXER</h1>
        </div>

        <div style="text-align:center;padding:40px 0 16px 0;">
          <div style="width:48px;height:48px;margin:0 auto 16px auto;border:2px solid #22C55E;border-radius:50%;
                      display:flex;align-items:center;justify-content:center;">
            <span style="color:#22C55E;font-size:24px;">✓</span>
          </div>
          <h2 style="font-size:20px;letter-spacing:4px;color:#E8E5DD;margin:0 0 8px 0;font-weight:300;">
            YOUR ORDER HAS BEEN DELIVERED
          </h2>
          <p style="color:#888;font-size:14px;margin:0;">
            Order ${order.orderNumber}
          </p>
        </div>

        <p style="color:#888;font-size:13px;line-height:1.7;text-align:center;margin:0 0 32px 0;">
          Your package has been delivered. We hope you love your new gear.
          If anything doesn't look right, don't hesitate to reach out.
        </p>

        <div style="text-align:center;margin-bottom:32px;">
          <a href="${siteUrl}/shop" style="display:inline-block;padding:14px 40px;background:#6A0E0E;color:#E8E5DD;
             text-decoration:none;font-size:11px;letter-spacing:3px;text-transform:uppercase;">
            Shop New Arrivals
          </a>
        </div>

        <div style="border-top:1px solid #2C2F33;padding-top:24px;text-align:center;">
          <p style="color:#555;font-size:11px;letter-spacing:1px;">
            Something wrong with your order? Reply to this email and we'll make it right.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  const textBody = `YOUR ORDER HAS BEEN DELIVERED\n\nOrder ${order.orderNumber}\n\nYour package has been delivered. We hope you love your new gear. If anything doesn't look right, don't hesitate to reach out by replying to this email.\n\nShop new arrivals: ${siteUrl}/shop`;

  try {
    await ses.send(
      new SendEmailCommand({
        Source: fromEmail,
        Destination: { ToAddresses: [order.email] },
        ReplyToAddresses: [process.env.SES_REPLY_TO_EMAIL || fromEmail],
        Message: {
          Subject: { Data: `Your ANTIVAXXER order has been delivered — ${order.orderNumber}`, Charset: 'UTF-8' },
          Body: {
            Html: { Data: htmlBody, Charset: 'UTF-8' },
            Text: { Data: textBody, Charset: 'UTF-8' },
          },
        },
      })
    );
    console.log(`[EMAIL] Delivery confirmation sent to ${order.email} for order ${order.orderNumber}`);
  } catch (error) {
    console.error(`[EMAIL] Delivery confirmation failed for order ${order.orderNumber}:`, error.message);
  }
}

module.exports = {
  sendOrderConfirmation,
  sendAbandonedCartEmail,
  sendPasswordResetEmail,
  sendFulfillmentEmail,
  sendWebhookFailureAlert,
  sendWelcomeEmail,
  sendShippingNotification,
  sendDeliveryConfirmation,
};
