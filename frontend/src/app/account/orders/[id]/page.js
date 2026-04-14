/**
 * Customer Order Detail — ANTIVAXXER
 *
 * [AV-017] feat: customer order history
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';

export default function OrderDetailPage() {
  const { data: session, status } = useSession();
  const params = useParams();
  const router = useRouter();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/account/login');
  }, [status, router]);

  const fetchOrder = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(`${API_URL}/account/orders/${params.id}`, {
        headers: {
          Authorization: `Bearer ${session.user.apiToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setOrder(data.order);
      }
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [API_URL, session, params.id]);

  useEffect(() => {
    if (session) fetchOrder();
  }, [session, fetchOrder]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <p className="text-av-bone-muted text-sm tracking-wider">Loading...</p>
    </div>;
  }

  if (!order) {
    return <div className="min-h-screen flex items-center justify-center">
      <p className="text-av-bone-muted text-sm">Order not found.</p>
    </div>;
  }

  const addr = (a) => a?.firstName
    ? `${a.firstName} ${a.lastName}, ${a.line1}, ${a.city}, ${a.state} ${a.zip}`
    : null;

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-20">
        <Link href="/account/orders" className="text-av-bone-muted text-xs tracking-wider hover:text-av-bone transition-colors">
          ← Order History
        </Link>

        <div className="flex items-center justify-between mt-4 mb-8">
          <h1 className="font-heading text-2xl tracking-widest text-av-bone">{order.orderNumber}</h1>
          <span className="text-av-bone-muted text-xs">{new Date(order.createdAt).toLocaleDateString()}</span>
        </div>

        {/* Status + Tracking */}
        <div className="border border-av-bone-faint p-5 mb-6">
          <div className="flex items-center justify-between">
            <span className="text-av-bone-muted text-[10px] tracking-widest uppercase">Status</span>
            <span className="text-av-bone text-sm capitalize">{order.status}</span>
          </div>
          {order.trackingNumber && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-av-bone-muted text-[10px] tracking-widest uppercase">Tracking</span>
              {order.trackingUrl ? (
                <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer"
                   className="text-av-red text-sm hover:underline">{order.trackingNumber}</a>
              ) : (
                <span className="text-av-bone text-sm">{order.trackingNumber}</span>
              )}
            </div>
          )}
        </div>

        {/* Line Items */}
        <div className="border border-av-bone-faint p-5 mb-6">
          <h2 className="font-heading text-sm tracking-widest text-av-bone mb-4">ITEMS</h2>
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between py-3 border-b border-av-bone-faint/50 last:border-0">
              <div>
                <p className="text-av-bone text-sm">{item.productName}</p>
                <p className="text-av-bone-muted text-[10px]">
                  {[item.colorName, item.sizeName].filter(Boolean).join(' / ')} · Qty: {item.quantity}
                </p>
              </div>
              <p className="text-av-bone text-sm">${item.lineTotal.toFixed(2)}</p>
            </div>
          ))}

          <div className="border-t border-av-bone-faint mt-4 pt-4 space-y-1 text-sm">
            <div className="flex justify-between text-av-bone-muted">
              <span>Subtotal</span><span>${order.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-av-bone-muted">
              <span>Shipping</span><span>{order.shippingAmount === 0 ? 'FREE' : `$${order.shippingAmount.toFixed(2)}`}</span>
            </div>
            <div className="flex justify-between text-av-bone text-base border-t border-av-bone-faint pt-2">
              <span>Total</span><span>${order.total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Shipping Address */}
        {addr(order.shippingAddress) && (
          <div className="border border-av-bone-faint p-5">
            <h2 className="font-heading text-sm tracking-widest text-av-bone mb-2">SHIPPED TO</h2>
            <p className="text-av-bone-muted text-sm">{addr(order.shippingAddress)}</p>
          </div>
        )}
      </div>
    </div>
  );
}
