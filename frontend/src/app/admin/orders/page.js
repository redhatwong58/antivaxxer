/**
 * Admin Order List Page — ANTIVAXXER
 *
 * [AV-015] feat: admin order management
 *
 * Displays all orders with status badges, totals, and filters.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/lib/adminAuth';

const STATUS_COLORS = {
  pending: 'bg-yellow-900/40 text-yellow-400',
  paid: 'bg-green-900/40 text-green-400',
  processing: 'bg-blue-900/40 text-blue-400',
  shipped: 'bg-purple-900/40 text-purple-400',
  delivered: 'bg-green-900/40 text-green-300',
  cancelled: 'bg-red-900/40 text-red-400',
  refunded: 'bg-av-bone-dim text-av-bone-muted',
};

export default function AdminOrdersPage() {
  const { ready, getHeaders } = useAdminAuth();
  const [orders, setOrders] = useState([]);
  const [pagination, setPagination] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  const fetchOrders = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      const res = await fetch(`${API_URL}/admin/orders?${params}`, {
        headers: getHeaders(),
      });
      if (!res.ok) throw new Error('Failed to load orders');
      const data = await res.json();
      setOrders(data.orders || []);
      setPagination(data.pagination || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_URL, ready, statusFilter, getHeaders]);

  useEffect(() => {
    if (ready) fetchOrders();
  }, [ready, fetchOrders]);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl tracking-widest text-av-bone">ORDERS</h1>
          {pagination && (
            <p className="text-av-bone-muted text-xs tracking-wider mt-1">
              {pagination.total} total orders
            </p>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone
                     text-xs tracking-wider outline-none focus:border-av-red"
        >
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="paid">Paid</option>
          <option value="processing">Processing</option>
          <option value="shipped">Shipped</option>
          <option value="delivered">Delivered</option>
          <option value="cancelled">Cancelled</option>
          <option value="refunded">Refunded</option>
        </select>
      </div>

      {loading && (
        <p className="text-av-bone-muted text-sm tracking-wider text-center py-16">Loading orders...</p>
      )}

      {error && !loading && (
        <div className="text-center py-16">
          <p className="text-av-red text-sm mb-4">{error}</p>
          <button onClick={fetchOrders}
            className="px-6 py-2 border border-av-red text-av-red text-xs tracking-widest uppercase hover:bg-av-red hover:text-white transition-colors">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-av-bone-faint">
                {['Order', 'Customer', 'Date', 'Items', 'Total', 'Status'].map((h) => (
                  <th key={h} className={`py-3 px-3 text-av-bone-muted text-[10px] tracking-widest uppercase font-normal ${h === 'Total' ? 'text-right' : h === 'Items' ? 'text-center' : 'text-left'}`}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr
                  key={order.id}
                  onClick={() => window.location.href = `/admin/orders/${order.id}`}
                  className="border-b border-av-bone-faint hover:bg-av-bone-faint/30 transition-colors cursor-pointer"
                >
                  <td className="py-3 px-3 text-av-bone font-mono text-xs">{order.orderNumber}</td>
                  <td className="py-3 px-3 text-av-bone-muted text-xs truncate max-w-[200px]">{order.email}</td>
                  <td className="py-3 px-3 text-av-bone-muted text-xs">
                    {new Date(order.createdAt).toLocaleDateString()}
                  </td>
                  <td className="py-3 px-3 text-av-bone-muted text-center">{order.itemCount}</td>
                  <td className="py-3 px-3 text-av-bone text-right">${order.total.toFixed(2)}</td>
                  <td className="py-3 px-3">
                    <span className={`text-[10px] px-2 py-0.5 tracking-widest uppercase ${STATUS_COLORS[order.status] || ''}`}>
                      {order.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {orders.length === 0 && (
            <p className="text-av-bone-muted text-sm text-center py-16">No orders found.</p>
          )}
        </div>
      )}
    </div>
  );
}
