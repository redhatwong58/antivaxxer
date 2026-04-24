/**
 * Order Confirmation Page — ANTIVAXXER
 *
 * [AV-013] feat: stripe webhook, order creation, inventory deduction
 * [AV-059] v5.4.0 — consumer flow fix: shows order number (from URL param),
 *   links to /account/orders if logged in, clearer messaging, "Create Account"
 *   CTA for guest checkouts.
 *
 * Shown after successful Stripe payment.
 */

'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';

function ConfirmationContent() {
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const orderNumber = searchParams.get('on');
  const paymentIntentId = searchParams.get('pi');

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="max-w-md w-full text-center">
        {/* Checkmark */}
        <div className="w-16 h-16 mx-auto mb-6 border-2 border-green-500 rounded-full
                        flex items-center justify-center">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
               stroke="#22C55E" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>

        <h1 className="font-heading text-3xl tracking-widest text-av-bone mb-3">
          ORDER CONFIRMED
        </h1>

        {orderNumber && (
          <p className="font-heading text-lg tracking-wider text-av-red mb-3">
            {orderNumber}
          </p>
        )}

        <p className="text-av-bone-muted text-sm font-light leading-relaxed mb-2">
          Thank you for your order. A confirmation email with your order
          details is on its way.
        </p>
        <p className="text-av-bone-muted text-xs font-light leading-relaxed mb-8">
          You&apos;ll receive tracking information once your order ships.
        </p>

        {paymentIntentId && !orderNumber && (
          <p className="text-av-bone-muted text-[10px] tracking-wider mb-6">
            Reference: {paymentIntentId.substring(0, 20)}...
          </p>
        )}

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          {session?.user && (
            <Link
              href="/account/orders"
              className="px-8 py-3 bg-av-red text-av-bone text-xs tracking-widest uppercase
                         hover:bg-av-red-hover transition-colors"
            >
              View My Orders
            </Link>
          )}
          <Link
            href="/shop"
            className={`px-8 py-3 text-xs tracking-widest uppercase transition-colors ${
              session?.user
                ? 'border border-av-bone-dim text-av-bone-muted hover:border-av-bone hover:text-av-bone'
                : 'bg-av-red text-av-bone hover:bg-av-red-hover'
            }`}
          >
            Continue Shopping
          </Link>
          {!session?.user && (
            <Link
              href="/account/register"
              className="px-8 py-3 border border-av-bone-dim text-av-bone-muted text-xs
                         tracking-widest uppercase hover:border-av-bone hover:text-av-bone
                         transition-colors"
            >
              Create Account
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ConfirmationPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-av-bone-muted text-sm tracking-wider">Loading...</p>
      </div>
    }>
      <ConfirmationContent />
    </Suspense>
  );
}
