/**
 * Checkout Page — ANTIVAXXER
 *
 * [AV-012] feat: checkout flow with stripe elements
 * [AV-059] v5.4.0 — consumer flow fixes:
 *   - Passes auth token if logged in (links order to user account)
 *   - Promo code input with inline validation
 *   - Passes orderNumber to confirmation page
 *
 * Multi-step checkout:
 * 1. Cart review + promo code (from CartContext)
 * 2. Shipping + billing address (with "same as shipping" checkbox)
 * 3. Payment via Stripe Elements
 *
 * Prices verified server-side — client prices are display-only.
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useCart } from '@/components/cart/CartContext';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

// ===== ADDRESS FORM COMPONENT =====
function AddressForm({ label, address, onChange }) {
  const update = (field, value) => onChange({ ...address, [field]: value });
  const fields = [
    { key: 'firstName', label: 'First Name', half: true },
    { key: 'lastName', label: 'Last Name', half: true },
    { key: 'line1', label: 'Address', half: false },
    { key: 'line2', label: 'Apt / Suite (optional)', half: false },
    { key: 'city', label: 'City', half: true },
    { key: 'state', label: 'State', half: false, maxLen: 2, placeholder: 'CA' },
    { key: 'zip', label: 'ZIP Code', half: false, maxLen: 10 },
  ];

  return (
    <div>
      <h3 className="font-heading text-sm tracking-widest text-av-bone mb-4">{label}</h3>
      <div className="grid grid-cols-2 gap-3">
        {fields.map((f) => (
          <div key={f.key} className={f.half ? '' : f.key === 'state' || f.key === 'zip' ? '' : 'col-span-2'}>
            <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
              {f.label}
            </label>
            <input
              type="text"
              value={address[f.key] || ''}
              onChange={(e) => update(f.key, e.target.value)}
              maxLength={f.maxLen}
              placeholder={f.placeholder || ''}
              className="w-full px-3 py-2.5 bg-av-gunmetal border border-av-bone-faint text-av-bone
                         text-sm outline-none focus:border-av-red transition-colors
                         placeholder:text-av-bone-muted/30"
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ===== PAYMENT FORM (inside Stripe Elements context) =====
function PaymentForm({ onSuccess, onError, processing, setProcessing }) {
  const stripe = useStripe();
  const elements = useElements();

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setProcessing(true);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required',
    });

    if (error) {
      onError(error.message);
      setProcessing(false);
    } else if (paymentIntent && paymentIntent.status === 'succeeded') {
      onSuccess(paymentIntent.id);
    } else {
      onError('Payment was not completed. Please try again.');
      setProcessing(false);
    }
  };

  return (
    <div>
      <PaymentElement
        options={{
          layout: 'tabs',
          defaultValues: { billingDetails: { address: { country: 'US' } } },
        }}
      />
      <button
        onClick={handleSubmit}
        disabled={!stripe || processing}
        className="w-full mt-6 py-4 bg-av-red text-av-bone text-xs tracking-widest uppercase
                   hover:bg-av-red-hover disabled:opacity-50 transition-colors"
      >
        {processing ? 'Processing...' : 'Place Order'}
      </button>
    </div>
  );
}

// ===== MAIN CHECKOUT PAGE =====
export default function CheckoutPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const { cart, cartTotal, cartCount, clearCart } = useCart();

  const [step, setStep] = useState(1); // 1: review, 2: address, 3: payment
  const [email, setEmail] = useState('');
  const [shippingAddress, setShippingAddress] = useState({
    firstName: '', lastName: '', line1: '', line2: '', city: '', state: '', zip: '',
  });
  const [billingAddress, setBillingAddress] = useState({
    firstName: '', lastName: '', line1: '', line2: '', city: '', state: '', zip: '',
  });
  const [sameAsShipping, setSameAsShipping] = useState(true);
  const [clientSecret, setClientSecret] = useState(null);
  const [serverTotals, setServerTotals] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [orderNumber, setOrderNumber] = useState(null);

  // [AV-059] v5.4.0 — promo code state
  const [promoCode, setPromoCode] = useState('');
  const [promoResult, setPromoResult] = useState(null); // { valid, promo: { code, type, value, discountAmount, freeShipping } }
  const [promoError, setPromoError] = useState(null);
  const [validatingPromo, setValidatingPromo] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  // Pre-fill email from session if logged in
  useEffect(() => {
    if (session?.user?.email && !email) {
      setEmail(session.user.email);
    }
  }, [session, email]);

  // Redirect if cart is empty
  useEffect(() => {
    if (cart.length === 0 && step === 1) {
      router.push('/shop');
    }
  }, [cart, step, router]);

  // [AV-059] v5.4.0 — validate promo code
  const validatePromoCode = async () => {
    if (!promoCode.trim()) return;
    setValidatingPromo(true);
    setPromoError(null);
    setPromoResult(null);
    try {
      // [WS-15] v5.6.0 — send auth header for per-user promo limit check
      const promoHeaders = { 'Content-Type': 'application/json' };
      if (session?.user?.apiToken) {
        promoHeaders['Authorization'] = `Bearer ${session.user.apiToken}`;
      }
      const res = await fetch(`${API_URL}/promos/validate`, {
        method: 'POST',
        headers: promoHeaders,
        body: JSON.stringify({
          code: promoCode.trim(),
          subtotal: cartTotal.toFixed(2),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPromoError(data?.error?.message || 'Invalid code');
      } else {
        setPromoResult(data);
      }
    } catch {
      setPromoError('Could not validate code. Try again.');
    } finally {
      setValidatingPromo(false);
    }
  };

  const removePromo = () => {
    setPromoCode('');
    setPromoResult(null);
    setPromoError(null);
  };

  // Create PaymentIntent when moving to payment step
  const createPaymentIntent = async () => {
    setError(null);
    setProcessing(true);

    try {
      // [AV-059] v5.4.0 — pass auth header if logged in (links order to user)
      const headers = { 'Content-Type': 'application/json' };
      if (session?.user?.apiToken) {
        headers['Authorization'] = `Bearer ${session.user.apiToken}`;
      }

      const res = await fetch(`${API_URL}/checkout/create-payment-intent`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          email,
          items: cart.map((item) => ({
            variantId: item.variantId,
            quantity: item.qty,
          })),
          shippingAddress,
          billingAddress: sameAsShipping ? shippingAddress : billingAddress,
          sameAsShipping,
          promoCode: promoResult?.promo?.code || '', // [AV-059] — server re-validates
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const msg = data?.error?.details
          ? data.error.details.join(' ')
          : data?.error?.message || 'Checkout failed.';
        throw new Error(msg);
      }

      setClientSecret(data.clientSecret);
      setServerTotals(data.totals);
      setOrderNumber(data.orderNumber); // [AV-059]
      setStep(3);
    } catch (err) {
      setError(err.message);
    } finally {
      setProcessing(false);
    }
  };

  // Handle successful payment — pass orderNumber to confirmation page
  const handlePaymentSuccess = (paymentIntentId) => {
    clearCart();
    const on = orderNumber ? `&on=${encodeURIComponent(orderNumber)}` : '';
    router.push(`/checkout/confirmation?pi=${paymentIntentId}${on}`);
  };

  // Validate address before proceeding
  const validateAddress = () => {
    const req = ['firstName', 'lastName', 'line1', 'city', 'state', 'zip'];
    const missing = req.filter((f) => !shippingAddress[f]?.trim());
    if (!email?.trim() || !email.includes('@')) {
      setError('Please enter a valid email address.');
      return false;
    }
    if (missing.length > 0) {
      setError('Please fill in all required shipping address fields.');
      return false;
    }
    if (!sameAsShipping) {
      const billingMissing = req.filter((f) => !billingAddress[f]?.trim());
      if (billingMissing.length > 0) {
        setError('Please fill in all required billing address fields.');
        return false;
      }
    }
    return true;
  };

  // Order summary sidebar
  const OrderSummary = () => {
    const totals = serverTotals || {
      subtotal: cartTotal.toFixed(2),
      discount: promoResult ? promoResult.promo.discountAmount : '0.00',
      promoCode: promoResult?.promo?.code || null,
      shipping: (promoResult?.promo?.freeShipping || cartTotal >= 75) ? '0.00' : '5.99',
      shippingLabel: (promoResult?.promo?.freeShipping || cartTotal >= 75) ? 'Free Shipping' : 'Standard Shipping',
      tax: '0.00',
      total: (
        cartTotal -
        (promoResult ? parseFloat(promoResult.promo.discountAmount) : 0) +
        ((promoResult?.promo?.freeShipping || cartTotal >= 75) ? 0 : 5.99)
      ).toFixed(2),
    };

    return (
      <div className="border border-av-bone-faint p-6">
        <h3 className="font-heading text-sm tracking-widest text-av-bone mb-4">ORDER SUMMARY</h3>
        <div className="space-y-3 text-sm">
          {cart.map((item) => (
            <div key={item.variantId} className="flex justify-between text-av-bone-muted">
              <span className="truncate max-w-[200px]">
                {item.name} {item.size && `(${item.size})`} × {item.qty}
              </span>
              <span>${(item.price * item.qty).toFixed(2)}</span>
            </div>
          ))}
          <div className="border-t border-av-bone-faint pt-3 flex justify-between text-av-bone-muted">
            <span>Subtotal</span>
            <span>${totals.subtotal}</span>
          </div>
          {parseFloat(totals.discount) > 0 && (
            <div className="flex justify-between text-green-400">
              <span>Discount {totals.promoCode && `(${totals.promoCode})`}</span>
              <span>-${totals.discount}</span>
            </div>
          )}
          <div className="flex justify-between text-av-bone-muted">
            <span>{totals.shippingLabel || 'Shipping'}</span>
            <span>{totals.shipping === '0.00' ? 'FREE' : `$${totals.shipping}`}</span>
          </div>
          <div className="flex justify-between text-av-bone-muted">
            <span>Tax</span>
            <span>{totals.tax === '0.00' ? '—' : `$${totals.tax}`}</span>
          </div>
          <div className="border-t border-av-bone-faint pt-3 flex justify-between text-av-bone text-base">
            <span>Total</span>
            <span>${totals.total}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-12">
        {/* Header */}
        <h1 className="font-heading text-3xl tracking-widest text-av-bone text-center mb-2">
          CHECKOUT
        </h1>

        {/* Step indicators */}
        <div className="flex justify-center gap-8 mb-10">
          {['Review', 'Address', 'Payment'].map((label, i) => (
            <span
              key={label}
              className={`text-[10px] tracking-widest uppercase ${
                step === i + 1 ? 'text-av-bone' : 'text-av-bone-muted/40'
              }`}
            >
              {i + 1}. {label}
            </span>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-6 px-4 py-3 bg-red-900/30 border border-red-800 text-red-300 text-sm max-w-2xl mx-auto">
            {error}
            <button onClick={() => setError(null)} className="ml-3 text-red-400 hover:text-red-200">×</button>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2">
            {/* STEP 1: Cart Review */}
            {step === 1 && (
              <div>
                <h2 className="font-heading text-lg tracking-widest text-av-bone mb-6">
                  REVIEW YOUR CART
                </h2>
                <div className="space-y-4 mb-8">
                  {cart.map((item) => (
                    <div key={item.variantId} className="flex gap-4 pb-4 border-b border-av-bone-faint">
                      <div className="w-16 h-16 bg-av-gunmetal flex-shrink-0 flex items-center justify-center">
                        <span className="font-heading text-xs text-av-bone-dim">AV</span>
                      </div>
                      <div className="flex-1">
                        <p className="text-av-bone text-sm">{item.name}</p>
                        <p className="text-av-bone-muted text-[10px] tracking-wider">
                          {[item.color, item.size].filter(Boolean).join(' / ')} · Qty: {item.qty}
                        </p>
                      </div>
                      <p className="text-av-bone text-sm">${(item.price * item.qty).toFixed(2)}</p>
                    </div>
                  ))}
                </div>

                {/* [AV-059] v5.4.0 — Promo code input */}
                <div className="mb-6 p-4 border border-av-bone-faint">
                  <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-2">
                    Promo Code
                  </label>
                  {promoResult ? (
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-av-bone text-sm font-heading tracking-wider">{promoResult.promo.code}</span>
                        <span className="text-green-400 text-xs ml-2">
                          {promoResult.promo.type === 'percentage'
                            ? `${promoResult.promo.value}% off`
                            : promoResult.promo.type === 'fixed_amount'
                            ? `$${Number(promoResult.promo.discountAmount).toFixed(2)} off`
                            : 'Free shipping'}
                        </span>
                      </div>
                      <button
                        onClick={removePromo}
                        className="text-av-bone-muted text-[10px] tracking-widest uppercase hover:text-av-red"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={promoCode}
                        onChange={(e) => { setPromoCode(e.target.value.toUpperCase()); setPromoError(null); }}
                        placeholder="Enter code"
                        className="flex-1 px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone
                                   text-sm uppercase outline-none focus:border-av-red transition-colors"
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); validatePromoCode(); } }}
                      />
                      <button
                        onClick={validatePromoCode}
                        disabled={validatingPromo || !promoCode.trim()}
                        className="px-4 py-2 bg-av-red text-av-bone text-[10px] tracking-widest uppercase
                                   hover:bg-av-red-hover disabled:opacity-50 transition-colors"
                      >
                        {validatingPromo ? '...' : 'Apply'}
                      </button>
                    </div>
                  )}
                  {promoError && (
                    <p className="text-red-400 text-xs mt-2">{promoError}</p>
                  )}
                </div>

                <button
                  onClick={() => setStep(2)}
                  disabled={cart.length === 0}
                  className="w-full py-3 bg-av-red text-av-bone text-xs tracking-widest uppercase
                             hover:bg-av-red-hover disabled:opacity-50 transition-colors"
                >
                  Continue to Address
                </button>
              </div>
            )}

            {/* STEP 2: Address */}
            {step === 2 && (
              <div className="space-y-6">
                {/* Email */}
                <div>
                  <h3 className="font-heading text-sm tracking-widest text-av-bone mb-4">
                    CONTACT
                  </h3>
                  <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.com"
                    className="w-full px-3 py-2.5 bg-av-gunmetal border border-av-bone-faint text-av-bone
                               text-sm outline-none focus:border-av-red transition-colors
                               placeholder:text-av-bone-muted/30"
                  />
                </div>

                <AddressForm label="SHIPPING ADDRESS" address={shippingAddress} onChange={setShippingAddress} />

                {/* Same as shipping checkbox */}
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={sameAsShipping}
                    onChange={(e) => setSameAsShipping(e.target.checked)}
                    className="accent-av-red"
                  />
                  <span className="text-av-bone-muted text-xs tracking-wider">
                    Billing address same as shipping
                  </span>
                </label>

                {!sameAsShipping && (
                  <AddressForm label="BILLING ADDRESS" address={billingAddress} onChange={setBillingAddress} />
                )}

                <div className="flex gap-3">
                  <button
                    onClick={() => setStep(1)}
                    className="px-6 py-3 border border-av-bone-faint text-av-bone-muted text-xs
                               tracking-widest uppercase hover:border-av-bone hover:text-av-bone transition-colors"
                  >
                    Back
                  </button>
                  <button
                    onClick={() => {
                      if (validateAddress()) createPaymentIntent();
                    }}
                    disabled={processing}
                    className="flex-1 py-3 bg-av-red text-av-bone text-xs tracking-widest uppercase
                               hover:bg-av-red-hover disabled:opacity-50 transition-colors"
                  >
                    {processing ? 'Preparing Payment...' : 'Continue to Payment'}
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3: Payment */}
            {step === 3 && clientSecret && (
              <div>
                <h2 className="font-heading text-lg tracking-widest text-av-bone mb-6">
                  PAYMENT
                </h2>
                <Elements
                  stripe={stripePromise}
                  options={{
                    clientSecret,
                    appearance: {
                      theme: 'night',
                      variables: {
                        colorPrimary: '#6A0E0E',
                        colorBackground: '#2C2F33',
                        colorText: '#E8E5DD',
                        colorDanger: '#FF4444',
                        borderRadius: '0px',
                        fontFamily: '"Helvetica Neue", Helvetica, Arial, sans-serif',
                      },
                    },
                  }}
                >
                  <PaymentForm
                    onSuccess={handlePaymentSuccess}
                    onError={(msg) => setError(msg)}
                    processing={processing}
                    setProcessing={setProcessing}
                  />
                </Elements>
                <button
                  onClick={() => setStep(2)}
                  disabled={processing}
                  className="mt-4 text-av-bone-muted text-xs tracking-wider hover:text-av-bone transition-colors"
                >
                  ← Back to Address
                </button>
              </div>
            )}
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <OrderSummary />
          </div>
        </div>
      </div>
    </div>
  );
}
