/**
 * Customer Order History — ANTIVAXXER
 *
 * [AV-017] feat: customer order history
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const STATUS_COLORS = {
  pending: 'bg-yellow-900/40 text-yellow-400',
  paid: 'bg-green-900/40 text-green-400',
  processing: 'bg-blue-900/40 text-blue-400',
  shipped: 'bg-purple-900/40 text-purple-400',
  delivered: 'bg-green-900/40 text-green-300',
  cancelled: 'bg-red-900/40 text-red-400',
  refunded: 'bg-av-bone-dim text-av-bone-muted',
};

export default function OrderHistoryPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/account/login');
  }, [status, router]);

  const fetchOrders = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(`${API_URL}/account/orders`, {
        headers: {
          Authorization: `Bearer ${session.user.apiToken}`,
        },
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data.orders || []);
      }
    } catch { /* silently fail */ }
    finally { setLoading(false); }
  }, [API_URL, session]);

  useEffect(() => {
    if (session) fetchOrders();
  }, [session, fetchOrders]);

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-av-bone-muted text-sm tracking-wider">Loading orders...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-3xl mx-auto px-4 py-20">
        <Link href="/account" className="text-av-bone-muted text-xs tracking-wider hover:text-av-bone transition-colors">
          ← My Account
        </Link>
        <h1 className="font-heading text-3xl tracking-widest text-av-bone mt-4 mb-8">
          ORDER HISTORY
        </h1>

        {orders.length === 0 ? (
          <div className="text-center py-16 border border-av-bone-faint">
            <p className="text-av-bone-muted text-sm mb-4">No orders yet.</p>
            <Link href="/shop"
              className="inline-block px-6 py-2 bg-av-red text-av-bone text-xs tracking-widest uppercase hover:bg-av-red-hover transition-colors">
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <Link key={order.id} href={`/account/orders/${order.id}`}
                className="block border border-av-bone-faint p-5 hover:border-av-red transition-colors group">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-av-bone font-mono text-sm">{order.orderNumber}</span>
                  <span className={`text-[10px] px-2 py-0.5 tracking-widest uppercase ${STATUS_COLORS[order.status] || ''}`}>
                    {order.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-av-bone-muted">
                  <span>{new Date(order.createdAt).toLocaleDateString()} · {order.itemCount} item{order.itemCount !== 1 ? 's' : ''}</span>
                  <span className="text-av-bone">${order.total.toFixed(2)}</span>
                </div>
                {order.trackingNumber && (
                  <p className="text-av-bone-muted text-[10px] mt-2">
                    Tracking: {order.trackingNumber}
                  </p>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
