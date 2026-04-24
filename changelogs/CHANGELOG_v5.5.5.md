# v5.5.5 — Discount line in order emails

**Release:**
**Tracking:** [AV-074]
**Migration required:** NO

## Finding

Both the customer order confirmation email and the internal fulfillment
email showed Subtotal, Shipping, Tax, and Total — but neither showed the
promo discount amount. When a customer used a promo code (e.g. WELCOME10
for 25% off), they'd see:

    Subtotal:  $100.00
    Shipping:  FREE
    Total:     $75.00    ← unexplained $25 gap

The `discountAmount` and `promoCode` fields existed on the order object
(set during checkout) but the email templates never displayed them.

## Fix

Added a conditional discount row to all 4 email bodies:
- Customer confirmation HTML ✅
- Customer confirmation text ✅
- Fulfillment HTML ✅
- Fulfillment text ✅

When `discountAmount > 0`, the totals now show:

    Subtotal:               $100.00
    Discount (WELCOME10):   -$25.00   ← green, with promo code name
    Shipping:               FREE
    Tax:                    —
    Total:                  $75.00

When no promo was applied (`discountAmount === 0`), the discount row
doesn't render at all — no visual change for non-promo orders.

## Details

- Discount amount rendered in green (#88C988) to distinguish from charges
- Promo code name shown in parentheses when available: "Discount (WELCOME10)"
- Minus sign prefix for clarity: "-$25.00"
- Same conditional pattern in both HTML and plain-text versions
- No other email templates affected (shipping notification, delivery
  confirmation, etc. don't show order totals)

## Files changed

- `api/src/services/email.js` — 4 template edits (2 per email function)

## Validation

- Parse: PASS
- Conditional renders correctly: discount row only appears when `discountAmount > 0`
- No changes to email trigger logic, send mechanics, or fire-and-forget pattern
