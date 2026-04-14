/**
 * Admin Product List Page — ANTIVAXXER
 *
 * [AV-008] feat: admin product list with temp auth gate
 *
 * Displays all products in a table with:
 * - Thumbnail, name, category, price, variant count
 * - Total stock, low stock warnings, out of stock alerts
 * - Status badges (active/draft/archived)
 * - Filter by status and low stock
 *
 * Auth: Uses NextAuth session with admin role check via useAdminAuth hook.
 * Phase 3 replaces with NextAuth session.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/lib/adminAuth';

export default function AdminProductsPage() {
  const { ready, getHeaders } = useAdminAuth();
  const [products, setProducts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [lowStockOnly, setLowStockOnly] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  // Fetch products
  const fetchProducts = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (lowStockOnly) params.set('lowStock', 'true');

      const res = await fetch(`${API_URL}/admin/products?${params}`, {
        headers: getHeaders(),
      });

      if (res.status === 401 || res.status === 403) {
        setError('Admin access denied.');
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to load products');

      setProducts(data.products || []);
      setSummary(data.summary || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_URL, ready, statusFilter, lowStockOnly, getHeaders]);

  useEffect(() => {
    if (ready) fetchProducts();
  }, [ready, fetchProducts]);

  // Stock level indicator
  const StockBadge = ({ total, lowCount, outCount }) => {
    if (outCount > 0) {
      return (
        <span className="text-[10px] px-2 py-0.5 bg-red-900/40 text-red-400 tracking-wider">
          {outCount} OUT
        </span>
      );
    }
    if (lowCount > 0) {
      return (
        <span className="text-[10px] px-2 py-0.5 bg-yellow-900/40 text-yellow-400 tracking-wider">
          {lowCount} LOW
        </span>
      );
    }
    return (
      <span className="text-[10px] px-2 py-0.5 bg-green-900/40 text-green-400 tracking-wider">
        OK
      </span>
    );
  };

  // Status badge
  const StatusBadge = ({ status }) => {
    const styles = {
      active: 'bg-green-900/40 text-green-400',
      draft: 'bg-yellow-900/40 text-yellow-400',
      archived: 'bg-av-bone-dim text-av-bone-muted',
    };
    return (
      <span className={`text-[10px] px-2 py-0.5 tracking-widest uppercase ${styles[status] || ''}`}>
        {status}
      </span>
    );
  };

  // useAdminAuth handles redirect for non-admin users
  if (!ready) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <p className="text-av-bone-muted text-sm tracking-wider">Loading admin...</p>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading text-2xl tracking-widest text-av-bone">
            PRODUCTS
          </h1>
          {summary && (
            <p className="text-av-bone-muted text-xs tracking-wider mt-1">
              {summary.total} products — {summary.active} active, {summary.draft} draft, {summary.archived} archived
            </p>
          )}
        </div>
        <a
          href="/admin/products/new"
          className="px-5 py-2.5 bg-av-red text-av-bone text-xs tracking-widest
                     uppercase hover:bg-av-red-hover transition-colors"
        >
          + Add Product
        </a>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          aria-label="Filter by status"
          className="px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone
                     text-xs tracking-wider outline-none focus:border-av-red"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="draft">Draft</option>
          <option value="archived">Archived</option>
        </select>
        <label className="flex items-center gap-2 text-av-bone-muted text-xs tracking-wider cursor-pointer">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="accent-av-red"
          />
          Low stock only
        </label>
      </div>

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <p className="text-av-bone-muted text-sm tracking-wider">Loading products...</p>
        </div>
      )}

      {/* Error */}
      {error && !loading && (
        <div className="text-center py-16">
          <p className="text-av-red text-sm mb-4">{error}</p>
          <button
            onClick={fetchProducts}
            className="px-6 py-2 border border-av-red text-av-red text-xs
                       tracking-widest uppercase hover:bg-av-red hover:text-white transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Product Table */}
      {!loading && !error && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-av-bone-faint">
                <th className="text-left py-3 px-2 text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">
                  Product
                </th>
                <th className="text-left py-3 px-2 text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">
                  Category
                </th>
                <th className="text-right py-3 px-2 text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">
                  Price
                </th>
                <th className="text-center py-3 px-2 text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">
                  Variants
                </th>
                <th className="text-right py-3 px-2 text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">
                  Stock
                </th>
                <th className="text-center py-3 px-2 text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">
                  Health
                </th>
                <th className="text-center py-3 px-2 text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {products.map((product) => (
                <tr
                  key={product.id}
                  onClick={() => window.location.href = `/admin/products/${product.id}`}
                  className="border-b border-av-bone-faint hover:bg-av-bone-faint/30
                             transition-colors cursor-pointer"
                >
                  {/* Product Name + Image */}
                  <td className="py-3 px-2">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-av-gunmetal flex-shrink-0 flex items-center justify-center">
                        {product.primaryImage ? (
                          <img
                            src={product.primaryImage}
                            alt={product.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span className="text-av-bone-dim text-[8px] font-heading">AV</span>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-av-bone text-sm font-light truncate max-w-[200px]">
                          {product.name}
                        </p>
                        {product.badge && (
                          <span className="text-av-red text-[9px] tracking-widest">
                            {product.badge}
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Category */}
                  <td className="py-3 px-2 text-av-bone-muted text-xs">
                    {product.category?.name}
                  </td>
                  {/* Price */}
                  <td className="py-3 px-2 text-av-bone text-right">
                    ${product.basePrice.toFixed(2)}
                  </td>
                  {/* Variant Count */}
                  <td className="py-3 px-2 text-av-bone-muted text-center">
                    {product.variantCount}
                  </td>
                  {/* Total Stock */}
                  <td className="py-3 px-2 text-av-bone text-right">
                    {product.totalStock}
                  </td>
                  {/* Stock Health */}
                  <td className="py-3 px-2 text-center">
                    <StockBadge
                      total={product.totalStock}
                      lowCount={product.lowStockCount}
                      outCount={product.outOfStockCount}
                    />
                  </td>
                  {/* Status */}
                  <td className="py-3 px-2 text-center">
                    <StatusBadge status={product.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {products.length === 0 && (
            <div className="text-center py-16">
              <p className="text-av-bone-muted text-sm">No products found with current filters.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
