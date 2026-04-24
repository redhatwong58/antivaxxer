/**
 * Admin Inventory Page — ANTIVAXXER
 *
 * [AV-050] v5.3.6 — top-level inventory view across ALL products. Previously,
 *   inventory editing was buried inside each individual product edit page.
 *   This page flattens every variant into one searchable, filterable table
 *   so admins can see low stock at a glance and click through to edit.
 *
 *   Stock editing itself still happens on /admin/products/[id] — this page
 *   is a read + drill-down view. A future enhancement could add inline
 *   stock editing here, but that needs a new bulk-update endpoint.
 *
 * To rollback: rm frontend/src/app/admin/inventory/page.js
 */

'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useAdminAuth } from '@/lib/adminAuth';

export default function AdminInventoryPage() {
  const { ready, getHeaders } = useAdminAuth();
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // all | low | out

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  const fetchProducts = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/admin/products`, { headers: getHeaders() });
      if (res.status === 401 || res.status === 403) {
        setError('Admin access denied.');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to load inventory');
      setProducts(data.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_URL, ready, getHeaders]);

  useEffect(() => { if (ready) fetchProducts(); }, [ready, fetchProducts]);

  // Flatten products → variants for the table. Done in useMemo so the
  // expensive flatten doesn't re-run on every render.
  const variantRows = useMemo(() => {
    const rows = [];
    for (const p of products) {
      for (const v of p.variants || []) {
        rows.push({
          variantId: v.id,
          productId: p.id,
          productName: p.name,
          productSlug: p.slug,
          category: p.category?.name || '',
          sku: v.sku,
          color: v.color || '',
          size: v.size || '',
          stockQty: v.stockQty,
          isLow: v.lowStock,
          isOut: v.outOfStock,
          isActive: v.isActive,
        });
      }
    }
    return rows;
  }, [products]);

  const filteredRows = useMemo(() => {
    let rows = variantRows;
    if (filter === 'low') rows = rows.filter((r) => r.isLow || r.isOut);
    if (filter === 'out') rows = rows.filter((r) => r.isOut);
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(
        (r) =>
          r.productName.toLowerCase().includes(q) ||
          r.sku.toLowerCase().includes(q) ||
          r.color.toLowerCase().includes(q) ||
          r.size.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q)
      );
    }
    return rows;
  }, [variantRows, filter, search]);

  const counts = useMemo(() => ({
    all: variantRows.length,
    low: variantRows.filter((r) => r.isLow || r.isOut).length,
    out: variantRows.filter((r) => r.isOut).length,
  }), [variantRows]);

  if (!ready) return <div className="text-av-bone-muted text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl tracking-widest text-av-bone">INVENTORY</h1>
          <p className="text-av-bone-muted text-xs mt-1">
            {filteredRows.length} of {counts.all} variants
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search SKU, product, color..."
            className="px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone text-xs w-64 outline-none focus:border-av-red"
          />
          <FilterTab active={filter === 'all'} onClick={() => setFilter('all')} count={counts.all}>All</FilterTab>
          <FilterTab active={filter === 'low'} onClick={() => setFilter('low')} count={counts.low} accent={counts.low > 0 ? 'yellow' : null}>Low</FilterTab>
          <FilterTab active={filter === 'out'} onClick={() => setFilter('out')} count={counts.out} accent={counts.out > 0 ? 'red' : null}>Out</FilterTab>
        </div>
      </div>

      {error && (
        <div className="text-center py-12">
          <p className="text-av-red text-sm mb-4">{error}</p>
          <button onClick={fetchProducts} className="px-4 py-2 border border-av-red text-av-red text-xs tracking-widest uppercase hover:bg-av-red hover:text-white transition-colors">
            Try Again
          </button>
        </div>
      )}

      {!error && loading && <p className="text-av-bone-muted text-sm">Loading inventory…</p>}

      {!error && !loading && filteredRows.length === 0 && (
        <p className="text-av-bone-muted text-sm italic py-8 text-center">
          No variants match the current filter.
        </p>
      )}

      {!error && !loading && filteredRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-av-bone-faint text-av-bone-muted text-[10px] tracking-widest uppercase text-left">
                <th className="py-2 pr-2">SKU</th>
                <th className="py-2 pr-2">Product</th>
                <th className="py-2 pr-2">Category</th>
                <th className="py-2 pr-2">Color</th>
                <th className="py-2 pr-2">Size</th>
                <th className="py-2 pr-2 text-right">Stock</th>
                <th className="py-2 pr-2 text-center">Status</th>
                <th className="py-2 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((r) => (
                <tr key={r.variantId} className="border-b border-av-bone-faint hover:bg-av-gunmetal/30">
                  <td className="py-3 pr-2 font-mono text-av-bone-muted text-[11px]">{r.sku}</td>
                  <td className="py-3 pr-2 text-av-bone truncate max-w-[220px]">{r.productName}</td>
                  <td className="py-3 pr-2 text-av-bone-muted">{r.category}</td>
                  <td className="py-3 pr-2 text-av-bone-muted">{r.color || '—'}</td>
                  <td className="py-3 pr-2 text-av-bone-muted">{r.size || '—'}</td>
                  <td className={`py-3 pr-2 text-right font-heading text-sm ${r.isOut ? 'text-av-red' : r.isLow ? 'text-yellow-400' : 'text-av-bone'}`}>
                    {r.stockQty}
                  </td>
                  <td className="py-3 pr-2 text-center">
                    {r.isOut ? (
                      <span className="text-[9px] px-2 py-0.5 bg-red-900/40 text-red-400 tracking-wider">OUT</span>
                    ) : r.isLow ? (
                      <span className="text-[9px] px-2 py-0.5 bg-yellow-900/40 text-yellow-400 tracking-wider">LOW</span>
                    ) : (
                      <span className="text-[9px] px-2 py-0.5 bg-green-900/40 text-green-400 tracking-wider">OK</span>
                    )}
                  </td>
                  <td className="py-3 pr-2 text-right">
                    <Link
                      href={`/admin/products/${r.productId}`}
                      className="text-av-bone-muted text-[10px] tracking-widest uppercase hover:text-av-red"
                    >
                      Edit
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

function FilterTab({ active, onClick, children, count, accent }) {
  const baseClass = 'px-3 py-2 text-[10px] tracking-widest uppercase border transition-colors';
  const activeClass = active
    ? 'bg-av-red border-av-red text-white'
    : 'border-av-bone-faint text-av-bone-muted hover:border-av-bone';
  const accentClass = !active && accent === 'red' ? 'text-av-red border-av-red/40' : !active && accent === 'yellow' ? 'text-yellow-400 border-yellow-700/40' : '';
  return (
    <button onClick={onClick} className={`${baseClass} ${activeClass} ${accentClass}`}>
      {children} <span className="opacity-60 ml-1">({count})</span>
    </button>
  );
}
