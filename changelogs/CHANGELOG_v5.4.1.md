# v5.4.1 — Email stack completion

**Release:**
**Tracking:** [AV-060]
**Migration required:** NO

> Reconstructed during v5.5.1 handover bundle pass. Original was shipped
> in `antivaxxer-v5.4.1.zip` to the operator's outputs but not retained
> in the active workspace. Content matches the actual code changes in
> `api/src/services/email.js` and `api/src/routes/webhooks.js`.

## Summary

Three new transactional emails to fill out the customer journey:

- **Welcome email** — fires after `/api/auth/register` succeeds
- **Shipping notification** — fires from two trigger points:
  - Shippo label purchase (`POST /api/admin/orders/:id/label`)
  - Manual order status change to `shipped` (`PUT /api/admin/orders/:id/status`)
- **Delivery confirmation** — fires when Shippo tracking webhook reports DELIVERED

All three follow the existing email stack's fire-and-forget pattern with
SES_FROM_EMAIL guard, inline HTML templates, and graceful failure (won't
break the calling flow if SES is down).

## Files changed

- `api/src/services/email.js` — added 3 new send* functions (sendWelcomeEmail, sendShippingNotification, sendDeliveryConfirmation)
- `api/src/routes/auth.js` — calls sendWelcomeEmail after registration
- `api/src/routes/admin.js` — calls sendShippingNotification on label purchase + manual status change
- `api/src/routes/webhooks.js` — calls sendDeliveryConfirmation on Shippo DELIVERED

## Validation

- Parse: PASS
- Structural QA: 30/30 PASS
- Email service file remains the single editable source for all 8 templates.
