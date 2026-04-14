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

const ses = new SESClient({
  region: process.env.AWS_REGION || 'us-east-1',
});

/**
 * Send order confirmation email.
 * @param {Object} order - Order with items included
 */
async function sendOrderConfirmation(order) {
  const fromEmail = process.env.SES_FROM_EMAIL;

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
Total: $${Number(order.total).toFixed(2)}

You will receive tracking information once your order ships.
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
          <h2 style="font-size:20px;letter-spacing:4px;color:#E8E5DD;margin:0 0 12px 0;font-weight:300;">YOU LEFT SOMETHING BEHIND</h2>
          <p style="color:#888;font-size:14px;line-height:1.7;margin:0 0 24px 0;">
            Looks like you didn't finish checking out. Your items are still waiting for you.
          </p>
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
            Text: { Data: `You left items in your cart. Complete your order: ${recoveryUrl}`, Charset: 'UTF-8' },
          },
        },
      })
    );
  } catch (error) {
    console.error(`[EMAIL] Abandoned cart email failed for ${cart.email}:`, error.message);
  }
}

module.exports = { sendOrderConfirmation, sendAbandonedCartEmail };
