/**
 * Cart Recovery Page — ANTIVAXXER
 *
 * [AV-034] feat: cart recovery page
 *
 * Linked from abandoned cart recovery emails.
 * Flow: email link → this page → API validates token → cart loaded → redirect to checkout.
 *
 * Error states:
 *   - Invalid token: shows message with link to shop
 *   - Already recovered: shows message with link to shop
 *   - Network error: shows retry option
 *
 * The recovery token is single-use. Once the cart is loaded, the token is
 * marked as recovered in the database and the link stops working.
 *
 * To rollback this feature: delete this file and /api/src/routes/cart.js.
 * Remove the replaceCart call from CartContext (the function can stay — it's harmless).
 */

'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useCart } from '@/components/cart/CartContext';
import Link from 'next/link';

function RecoveryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { replaceCart } = useCart();
  const [status, setStatus] = useState('loading'); // loading | recovered | error
  const [errorMessage, setErrorMessage] = useState('');

  const token = searchParams.get('token');
  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setErrorMessage('No recovery token provided.');
      return;
    }

    const recover = async () => {
      try {
        const res = await fetch(`${API_URL}/cart/recover/${token}`);
        const data = await res.json();

        if (!res.ok) {
          setStatus('error');
          setErrorMessage(data?.error?.message || 'This recovery link is no longer valid.');
          return;
        }

        if (data.recovered && data.cart) {
          // Cart data is an array of cart items — same shape as CartContext
          replaceCart(Array.isArray(data.cart) ? data.cart : []);
          setStatus('recovered');

          // Brief pause to show success message, then redirect to checkout
          setTimeout(() => {
            router.push('/checkout');
          }, 1500);
        } else {
          setStatus('error');
          setErrorMessage('Unable to restore your cart.');
        }
      } catch {
        setStatus('error');
        setErrorMessage('Something went wrong. Please try again.');
      }
    };

    recover();
  }, [token, API_URL, replaceCart, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm text-center">
        {status === 'loading' && (
          <>
            <h1 className="font-heading text-2xl tracking-widest text-av-bone mb-4">
              RESTORING YOUR CART
            </h1>
            <p className="text-av-bone-muted text-sm">Loading your saved items...</p>
          </>
        )}

        {status === 'recovered' && (
          <>
            <h1 className="font-heading text-2xl tracking-widest text-av-bone mb-4">
              CART RESTORED
            </h1>
            <p className="text-av-bone-muted text-sm mb-4">
              Your items have been loaded. Redirecting to checkout...
            </p>
            <div className="w-8 h-px bg-av-red mx-auto" />
          </>
        )}

        {status === 'error' && (
          <>
            <h1 className="font-heading text-2xl tracking-widest text-av-bone mb-4">
              LINK EXPIRED
            </h1>
            <p className="text-av-bone-muted text-sm mb-6">{errorMessage}</p>
            <Link
              href="/shop"
              className="inline-block px-6 py-3 bg-av-red text-av-bone text-xs
                         tracking-widest uppercase hover:bg-av-red-hover transition-colors"
            >
              Continue Shopping
            </Link>
          </>
        )}
      </div>
    </div>
  );
}

export default function CartRecoverPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-av-bone-muted text-sm">Loading...</p>
      </div>
    }>
      <RecoveryContent />
    </Suspense>
  );
}
