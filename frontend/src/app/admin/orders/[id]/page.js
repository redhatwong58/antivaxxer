/**
 * Admin Order Detail Page — ANTIVAXXER
 *
 * [AV-015] feat: admin order management
 *
 * Shows full order: customer, addresses, line items, payment info,
 * status update dropdown, tracking number input, admin notes.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/adminAuth';

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { ready, getHeaders } = useAdminAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Editable fields
  const [status, setStatus] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  const fetchOrder = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/admin/orders/${params.id}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load order');
      const data = await res.json();
      setOrder(data.order);
      setStatus(data.order.status);
      setTrackingNumber(data.order.trackingNumber || '');
      setNotes(data.order.notes || '');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_URL, ready, params.id, getHeaders]);

  useEffect(() => {
    if (ready) fetchOrder();
  }, [ready, fetchOrder]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await fetch(`${API_URL}/admin/orders/${params.id}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify({ status, trackingNumber, notes }),
      });
      if (!res.ok) throw new Error('Failed to update order');
      setSuccess('Order updated.');
      fetchOrder();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-av-bone-muted text-sm tracking-wider text-center py-20">Loading order...</p>;
  }

  if (!order) {
    return <p className="text-av-red text-sm text-center py-20">Order not found.</p>;
  }

  const addr = (a) => a?.firstName
    ? `${a.firstName} ${a.lastName}, ${a.line1}${a.line2 ? ', ' + a.line2 : ''}, ${a.city}, ${a.state} ${a.zip}`
    : 'Not provided';

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <button onClick={() => router.push('/admin/orders')}
        className="text-av-bone-muted text-xs tracking-wider hover:text-av-bone transition-colors mb-4">
        ← Back to Orders
      </button>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl tracking-widest text-av-bone">
            {order.orderNumber}
          </h1>
          <p className="text-av-bone-muted text-xs tracking-wider mt-1">
            {new Date(order.createdAt).toLocaleString()} · {order.email}
          </p>
        </div>
        <button onClick={handleSave} disabled={saving}
          className="px-6 py-2.5 bg-av-red text-av-bone text-xs tracking-widest uppercase hover:bg-av-red-hover disabled:opacity-50 transition-colors">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      {error && <div className="mb-6 px-4 py-3 bg-red-900/30 border border-red-800 text-red-300 text-sm">{error}</div>}
      {success && <div className="mb-6 px-4 py-3 bg-green-900/30 border border-green-800 text-green-300 text-sm">{success}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
        {/* Status + Tracking */}
        <div className="border border-av-bone-faint p-6 space-y-4">
          <h2 className="font-heading text-sm tracking-widest text-av-bone">STATUS</h2>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone text-sm outline-none focus:border-av-red">
            {STATUSES.map((s) => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <div>
            <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">Tracking Number</label>
            <input type="text" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Enter tracking number"
              className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone text-sm outline-none focus:border-av-red placeholder:text-av-bone-muted/30" />
          </div>
          <div>
            <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">Admin Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone text-sm outline-none focus:border-av-red resize-y" />
          </div>
        </div>

        {/* Addresses + Payment */}
        <div className="border border-av-bone-faint p-6 space-y-4">
          <h2 className="font-heading text-sm tracking-widest text-av-bone">DETAILS</h2>
          <div>
            <p className="text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">Shipping</p>
            <p className="text-av-bone text-sm font-light">{addr(order.shippingAddress)}</p>
          </div>
          <div>
            <p className="text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">Billing</p>
            <p className="text-av-bone text-sm font-light">{addr(order.billingAddress)}</p>
          </div>
          {order.stripePaymentIntentId && (
            <div>
              <p className="text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">Stripe</p>
              <p className="text-av-bone text-xs font-mono">{order.stripePaymentIntentId}</p>
            </div>
          )}
        </div>
      </div>

      {/* Line Items */}
      <div className="border border-av-bone-faint p-6 mb-8">
        <h2 className="font-heading text-sm tracking-widest text-av-bone mb-4">
          LINE ITEMS ({order.items.length})
        </h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-av-bone-faint">
              <th className="py-2 px-2 text-left text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">Product</th>
              <th className="py-2 px-2 text-left text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">SKU</th>
              <th className="py-2 px-2 text-center text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">Qty</th>
              <th className="py-2 px-2 text-right text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">Price</th>
              <th className="py-2 px-2 text-right text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">Total</th>
            </tr>
          </thead>
          <tbody>
            {order.items.map((item) => (
              <tr key={item.id} className="border-b border-av-bone-faint/50">
                <td className="py-2 px-2">
                  <p className="text-av-bone text-sm">{item.productName}</p>
                  <p className="text-av-bone-muted text-[10px]">{[item.colorName, item.sizeName].filter(Boolean).join(' / ')}</p>
                </td>
                <td className="py-2 px-2 text-av-bone-muted font-mono text-xs">{item.sku}</td>
                <td className="py-2 px-2 text-av-bone text-center">{item.quantity}</td>
                <td className="py-2 px-2 text-av-bone text-right">${item.unitPrice.toFixed(2)}</td>
                <td className="py-2 px-2 text-av-bone text-right">${item.lineTotal.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="border-t border-av-bone-faint mt-4 pt-4 max-w-xs ml-auto space-y-1">
          <div className="flex justify-between text-av-bone-muted text-sm">
            <span>Subtotal</span><span>${order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-av-bone-muted text-sm">
            <span>Shipping</span><span>{order.shippingAmount === 0 ? 'FREE' : `$${order.shippingAmount.toFixed(2)}`}</span>
          </div>
          <div className="flex justify-between text-av-bone-muted text-sm">
            <span>Tax</span><span>{order.taxAmount === 0 ? '—' : `$${order.taxAmount.toFixed(2)}`}</span>
          </div>
          <div className="flex justify-between text-av-bone text-base border-t border-av-bone-faint pt-2">
            <span>Total</span><span>${order.total.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
