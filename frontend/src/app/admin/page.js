/**
 * Admin Dashboard — ANTIVAXXER
 *
 * [AV-050] v5.3.6 — landing page for /admin. Pulls the consolidated dashboard
 *   payload from GET /api/admin/dashboard and renders six stat tiles, top
 *   sellers, recent orders, and a low stock alert list. All queries run
 *   server-side in one round trip.
 *
 * To rollback: cp _rollback/v5.3.5/app/admin/page.js frontend/src/app/admin/page.js
 *   (note: pre-v5.3.6, this file was the products list — see /admin/products/page.js)
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useAdminAuth } from '@/lib/adminAuth';

const fmtMoney = (n) => '$' + Number(n).toFixed(2);
const fmtDate = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' · ' +
    d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
};

const STATUS_STYLES = {
  pending: 'bg-av-bone-dim text-av-bone-muted',
  paid: 'bg-yellow-900/40 text-yellow-400',
  processing: 'bg-blue-900/40 text-blue-400',
  shipped: 'bg-purple-900/40 text-purple-400',
  delivered: 'bg-green-900/40 text-green-400',
  cancelled: 'bg-red-900/40 text-red-400',
  refunded: 'bg-red-900/40 text-red-400',
};

function StatusPill({ status }) {
  return (
    <span className={`text-[9px] px-2 py-0.5 tracking-widest uppercase ${STATUS_STYLES[status] || ''}`}>
      {status}
    </span>
  );
}

export default function AdminDashboardPage() {
  const { ready, getHeaders } = useAdminAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  const fetchDashboard = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/admin/dashboard?days=7`, { headers: getHeaders() });
      if (res.status === 401 || res.status === 403) {
        setError('Admin access denied.');
        return;
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error?.message || 'Failed to load dashboard');
      setData(json);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_URL, ready, getHeaders]);

  useEffect(() => { if (ready) fetchDashboard(); }, [ready, fetchDashboard]);

  if (!ready || loading) {
    return <div className="text-av-bone-muted text-sm">Loading dashboard…</div>;
  }
  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-av-red text-sm mb-4">{error}</p>
        <button onClick={fetchDashboard} className="px-4 py-2 border border-av-red text-av-red text-xs tracking-widest uppercase hover:bg-av-red hover:text-white transition-colors">
          Try Again
        </button>
      </div>
    );
  }
  if (!data) return null;

  const { stats, recentOrders, lowStock, topSellers } = data;

  return (
    <div className="space-y-8">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-heading text-2xl tracking-widest text-av-bone">DASHBOARD</h1>
          <p className="text-av-bone-muted text-xs mt-1">Last 7 days</p>
        </div>
      </div>

      {/* Low stock alert banner */}
      {stats.lowStockCount > 0 && (
        <div className="border border-av-red bg-red-900/10 px-4 py-3 flex items-center gap-3">
          <span className="text-av-red text-lg">⚠</span>
          <span className="text-sm text-av-bone flex-1">
            <strong className="text-av-red">{stats.lowStockCount} item{stats.lowStockCount !== 1 ? 's' : ''} low on stock.</strong> Review inventory to prevent stockouts.
          </span>
          <Link href="/admin/inventory" className="text-av-red text-[10px] tracking-widest uppercase hover:underline">
            View →
          </Link>
        </div>
      )}

      {/* 6 stat tiles */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <StatTile label="Revenue (7d)" value={fmtMoney(stats.revenue)} />
        <StatTile label="Orders (7d)" value={stats.orderCount} />
        <StatTile label="Avg Order" value={fmtMoney(stats.aov)} />
        <StatTile label="Pending Fulfillment" value={stats.pendingFulfillment} accent={stats.pendingFulfillment > 0 ? 'red' : null} />
        <StatTile label="Low Stock" value={stats.lowStockCount} accent={stats.lowStockCount > 0 ? 'red' : null} />
        <StatTile label="New Customers (7d)" value={stats.newCustomers} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Top sellers (last 30 days) */}
        <div className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-av-bone-faint">
            <h2 className="font-heading text-sm tracking-widest text-av-bone">TOP SELLERS</h2>
            <span className="text-av-bone-muted text-[10px] tracking-wider">Last 30 days</span>
          </div>
          {topSellers.length === 0 ? (
            <p className="text-av-bone-muted text-xs italic py-4">No sales yet</p>
          ) : (
            <div className="space-y-3">
              {topSellers.map((s, i) => (
                <div key={s.productId} className="flex items-center gap-3">
                  <span className="font-heading text-av-red text-lg w-5">{i + 1}</span>
                  {s.thumbnail ? (
                    <Image src={s.thumbnail} alt={s.name} width={40} height={40} className="object-cover bg-av-gunmetal" />
                  ) : (
                    <div className="w-10 h-10 bg-av-gunmetal flex items-center justify-center">
                      <span className="text-av-bone-dim text-[8px] font-heading">AV</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-av-bone text-xs truncate">{s.name}</p>
                    <p className="text-av-bone-muted text-[10px]">{s.unitsSold} sold · {fmtMoney(s.revenue)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent orders */}
        <div className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-av-bone-faint">
            <h2 className="font-heading text-sm tracking-widest text-av-bone">RECENT ORDERS</h2>
            <Link href="/admin/orders" className="text-av-bone-muted text-[10px] tracking-wider uppercase hover:text-av-red">
              View all →
            </Link>
          </div>
          {recentOrders.length === 0 ? (
            <p className="text-av-bone-muted text-xs italic py-4">No orders yet</p>
          ) : (
            <table className="w-full text-xs">
              <tbody>
                {recentOrders.map((o) => (
                  <tr key={o.id} className="border-b border-av-bone-faint">
                    <td className="py-3 pr-2">
                      <Link href={`/admin/orders/${o.id}`} className="text-av-bone hover:text-av-red font-mono text-[11px]">
                        {o.orderNumber}
                      </Link>
                    </td>
                    <td className="py-3 pr-2 text-av-bone-muted truncate max-w-[180px]">{o.email}</td>
                    <td className="py-3 pr-2"><StatusPill status={o.status} /></td>
                    <td className="py-3 pr-2 text-right text-av-bone">{fmtMoney(o.total)}</td>
                    <td className="py-3 text-right text-av-bone-muted text-[10px]">{fmtDate(o.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Low stock list (if any) */}
      {lowStock.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4 pb-2 border-b border-av-bone-faint">
            <h2 className="font-heading text-sm tracking-widest text-av-bone">LOW STOCK</h2>
            <Link href="/admin/inventory" className="text-av-bone-muted text-[10px] tracking-wider uppercase hover:text-av-red">
              Manage →
            </Link>
          </div>
          <div className="space-y-2">
            {lowStock.map((s) => (
              <div key={s.variantId} className="flex items-center justify-between text-xs border border-av-bone-faint px-3 py-2">
                <div className="flex-1">
                  <span className="text-av-bone">{s.productName}</span>
                  <span className="text-av-bone-muted ml-2">
                    {[s.color, s.size].filter(Boolean).join(' · ')} · {s.sku}
                  </span>
                </div>
                <span className={`font-heading text-sm ${s.outOfStock ? 'text-av-red' : 'text-yellow-400'}`}>
                  {s.outOfStock ? 'OUT' : `${s.stockQty} left`}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatTile({ label, value, accent }) {
  const valueClass = accent === 'red' ? 'text-av-red' : 'text-av-bone';
  return (
    <div className="border border-av-bone-faint p-4">
      <div className="text-av-bone-muted text-[10px] tracking-widest uppercase">{label}</div>
      <div className={`font-heading text-3xl mt-2 ${valueClass}`}>{value}</div>
    </div>
  );
}
