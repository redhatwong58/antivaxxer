/**
 * Admin Customer Detail Page — ANTIVAXXER
 *
 * [AV-050] v5.3.6 — profile view + full order history for a single customer.
 *   Each order links through to /admin/orders/[id] (the existing admin
 *   order detail page) for status changes, item details, etc.
 *
 * To rollback: rm -rf frontend/src/app/admin/customers/[id]
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useAdminAuth } from '@/lib/adminAuth';

const fmtMoney = (n) => '$' + Number(n).toFixed(2);
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const STATUS_STYLES = {
  pending: 'bg-av-bone-dim text-av-bone-muted',
  paid: 'bg-yellow-900/40 text-yellow-400',
  processing: 'bg-blue-900/40 text-blue-400',
  shipped: 'bg-purple-900/40 text-purple-400',
  delivered: 'bg-green-900/40 text-green-400',
  cancelled: 'bg-red-900/40 text-red-400',
  refunded: 'bg-red-900/40 text-red-400',
};

export default function AdminCustomerDetailPage() {
  const params = useParams();
  const id = params?.id;
  const { ready, getHeaders } = useAdminAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  const fetchCustomer = useCallback(async () => {
    if (!ready || !id) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/admin/customers/${id}`, { headers: getHeaders() });
      if (res.status === 401 || res.status === 403) {
        setError('Admin access denied.');
        return;
      }
      if (res.status === 404) {
        setError('Customer not found.');
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load customer');
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_URL, ready, getHeaders, id]);

  useEffect(() => { if (ready) fetchCustomer(); }, [ready, fetchCustomer]);

  if (!ready || loading) return <div className="text-av-bone-muted text-sm">Loading…</div>;

  if (error) {
    return (
      <div className="space-y-4">
        <Link href="/admin/customers" className="text-av-bone-muted text-[10px] tracking-widest uppercase hover:text-av-red">← Back to customers</Link>
        <div className="text-center py-12">
          <p className="text-av-red text-sm mb-4">{error}</p>
          <button onClick={fetchCustomer} className="px-4 py-2 border border-av-red text-av-red text-xs tracking-widest uppercase hover:bg-av-red hover:text-white transition-colors">Try Again</button>
        </div>
      </div>
    );
  }

  if (!data) return null;
  const { customer, orders } = data;

  return (
    <div className="space-y-6">
      <Link href="/admin/customers" className="text-av-bone-muted text-[10px] tracking-widest uppercase hover:text-av-red inline-block">
        ← Back to customers
      </Link>

      {/* Profile header */}
      <div className="border border-av-bone-faint p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-2xl tracking-widest text-av-bone">{customer.name}</h1>
            <p className="text-av-bone-muted text-sm mt-1">{customer.email}</p>
            <p className="text-av-bone-muted text-[10px] mt-2 tracking-wider uppercase">
              Member since {fmtDate(customer.joined)} · {customer.role}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-6 text-right">
            <div>
              <div className="text-av-bone-muted text-[10px] tracking-widest uppercase">Orders</div>
              <div className="font-heading text-3xl text-av-bone mt-1">{customer.orderCount}</div>
            </div>
            <div>
              <div className="text-av-bone-muted text-[10px] tracking-widest uppercase">Lifetime Spend</div>
              <div className="font-heading text-3xl text-av-bone mt-1">{fmtMoney(customer.lifetimeSpend)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Order history */}
      <div>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-av-bone-faint">
          <h2 className="font-heading text-sm tracking-widest text-av-bone">ORDER HISTORY</h2>
          <span className="text-av-bone-muted text-[10px] tracking-wider">
            {orders.length} order{orders.length !== 1 ? 's' : ''}
          </span>
        </div>
        {orders.length === 0 ? (
          <p className="text-av-bone-muted text-sm italic py-8 text-center">
            This customer hasn&apos;t placed any orders yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-av-bone-faint text-av-bone-muted text-[10px] tracking-widest uppercase text-left">
                  <th className="py-2 pr-2">Order #</th>
                  <th className="py-2 pr-2">Date</th>
                  <th className="py-2 pr-2 text-center">Status</th>
                  <th className="py-2 pr-2 text-right">Items</th>
                  <th className="py-2 pr-2 text-right">Total</th>
                  <th className="py-2 pr-2">Tracking</th>
                  <th className="py-2 pr-2"></th>
                </tr>
              </thead>
              <tbody>
                {orders.map((o) => (
                  <tr key={o.id} className="border-b border-av-bone-faint hover:bg-av-gunmetal/30">
                    <td className="py-3 pr-2 font-mono text-[11px]">
                      <Link href={`/admin/orders/${o.id}`} className="text-av-bone hover:text-av-red">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="py-3 pr-2 text-av-bone-muted text-[10px]">{fmtDate(o.createdAt)}</td>
                    <td className="py-3 pr-2 text-center">
                      <span className={`text-[9px] px-2 py-0.5 tracking-widest uppercase ${STATUS_STYLES[o.status] || ''}`}>
                        {o.status}
                      </span>
                    </td>
                    <td className="py-3 pr-2 text-right text-av-bone">{o.itemCount}</td>
                    <td className="py-3 pr-2 text-right font-heading text-av-bone">{fmtMoney(o.total)}</td>
                    <td className="py-3 pr-2 text-av-bone-muted text-[10px] font-mono">
                      {o.trackingNumber || '—'}
                    </td>
                    <td className="py-3 pr-2 text-right">
                      <Link href={`/admin/orders/${o.id}`} className="text-av-bone-muted text-[10px] tracking-widest uppercase hover:text-av-red">
                        View →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
