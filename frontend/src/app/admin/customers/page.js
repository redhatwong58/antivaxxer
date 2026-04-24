/**
 * Admin Customers Page — ANTIVAXXER
 *
 * [AV-050] v5.3.6 — frontend for GET /api/admin/customers. Searchable list
 *   with aggregated order count and lifetime spend per customer. Click a
 *   customer to drill into their profile + order history.
 *
 * To rollback: rm frontend/src/app/admin/customers/page.js
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/lib/adminAuth';

const fmtMoney = (n) => '$' + Number(n).toFixed(2);
const fmtDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

export default function AdminCustomersPage() {
  const { ready, getHeaders } = useAdminAuth();
  const [customers, setCustomers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  // Debounce search input by 300ms so we don't hammer the API on every keystroke
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
      params.set('limit', '100');
      const res = await fetch(`${API_URL}/admin/customers?${params}`, { headers: getHeaders() });
      if (res.status === 401 || res.status === 403) {
        setError('Admin access denied.');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to load customers');
      setCustomers(data.customers || []);
      setTotal(data.pagination?.total || 0);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_URL, ready, getHeaders, debouncedSearch]);

  useEffect(() => { if (ready) fetchCustomers(); }, [ready, fetchCustomers]);

  if (!ready) return <div className="text-av-bone-muted text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl tracking-widest text-av-bone">CUSTOMERS</h1>
          <p className="text-av-bone-muted text-xs mt-1">
            {customers.length}{debouncedSearch ? ` of ${total} matching` : ` of ${total} total`}
          </p>
        </div>
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search name or email..."
          className="px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone text-xs w-64 outline-none focus:border-av-red"
        />
      </div>

      {error && (
        <div className="text-center py-12">
          <p className="text-av-red text-sm mb-4">{error}</p>
          <button onClick={fetchCustomers} className="px-4 py-2 border border-av-red text-av-red text-xs tracking-widest uppercase hover:bg-av-red hover:text-white transition-colors">Try Again</button>
        </div>
      )}

      {!error && loading && <p className="text-av-bone-muted text-sm">Loading…</p>}

      {!error && !loading && customers.length === 0 && (
        <p className="text-av-bone-muted text-sm italic py-8 text-center">
          {debouncedSearch ? 'No customers match the search.' : 'No customers yet.'}
        </p>
      )}

      {!error && !loading && customers.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-av-bone-faint text-av-bone-muted text-[10px] tracking-widest uppercase text-left">
                <th className="py-2 pr-2">Name</th>
                <th className="py-2 pr-2">Email</th>
                <th className="py-2 pr-2 text-right">Orders</th>
                <th className="py-2 pr-2 text-right">Lifetime Spend</th>
                <th className="py-2 pr-2">Joined</th>
                <th className="py-2 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.id} className="border-b border-av-bone-faint hover:bg-av-gunmetal/30">
                  <td className="py-3 pr-2 text-av-bone">{c.name}</td>
                  <td className="py-3 pr-2 text-av-bone-muted">{c.email}</td>
                  <td className="py-3 pr-2 text-right text-av-bone">{c.orderCount}</td>
                  <td className="py-3 pr-2 text-right font-heading text-av-bone">{fmtMoney(c.lifetimeSpend)}</td>
                  <td className="py-3 pr-2 text-av-bone-muted text-[10px]">{fmtDate(c.joined)}</td>
                  <td className="py-3 pr-2 text-right">
                    <Link
                      href={`/admin/customers/${c.id}`}
                      className="text-av-bone-muted text-[10px] tracking-widest uppercase hover:text-av-red"
                    >
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
  );
}
