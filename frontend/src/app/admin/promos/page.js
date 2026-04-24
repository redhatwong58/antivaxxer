/**
 * Admin Promos Page — ANTIVAXXER
 *
 * [AV-050] v5.3.6 — frontend for the existing /api/admin/promos endpoints.
 *   Lists all promo codes, supports create/update/delete/toggle-active.
 *
 *   Promo type values: 'percentage' | 'fixed_amount' | 'free_shipping'
 *
 *   Delete refuses on the backend if any usages exist (preserves order
 *   history). In that case the API returns 409 IN_USE and the UI shows
 *   the error and suggests deactivating instead.
 *
 * To rollback: rm frontend/src/app/admin/promos/page.js
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/lib/adminAuth';

const TYPE_LABELS = {
  percentage: '% off',
  fixed_amount: '$ off',
  free_shipping: 'Free ship',
};

function formatValue(promo) {
  if (promo.type === 'percentage') return `${promo.value}%`;
  if (promo.type === 'fixed_amount') return `$${Number(promo.value).toFixed(2)}`;
  return 'Free shipping';
}

const blankForm = {
  code: '',
  type: 'percentage',
  value: '',
  minOrderAmount: '',
  maxUses: '',
  maxUsesPerUser: '',
  startsAt: '',
  expiresAt: '',
};

export default function AdminPromosPage() {
  const { ready, getHeaders } = useAdminAuth();
  const [promos, setPromos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blankForm);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  const fetchPromos = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/admin/promos`, { headers: getHeaders() });
      if (res.status === 401 || res.status === 403) {
        setError('Admin access denied.');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to load promos');
      setPromos(data.promos || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_URL, ready, getHeaders]);

  useEffect(() => { if (ready) fetchPromos(); }, [ready, fetchPromos]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setActionError(null);
    setSaving(true);
    try {
      const body = {
        code: form.code.trim().toUpperCase(),
        type: form.type,
        value: form.type === 'free_shipping' ? 0 : Number(form.value),
        minOrderAmount: form.minOrderAmount ? Number(form.minOrderAmount) : null,
        maxUses: form.maxUses ? parseInt(form.maxUses) : null,
        maxUsesPerUser: form.maxUsesPerUser ? parseInt(form.maxUsesPerUser) : null,
        startsAt: form.startsAt || null,
        expiresAt: form.expiresAt || null,
      };
      const res = await fetch(`${API_URL}/admin/promos`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Create failed');
      setForm(blankForm);
      setShowForm(false);
      await fetchPromos();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (promo) => {
    setActionError(null);
    try {
      const res = await fetch(`${API_URL}/admin/promos/${promo.id}`, {
        method: 'PUT',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !promo.isActive }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || 'Update failed');
      }
      await fetchPromos();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const handleDelete = async (promo) => {
    if (!confirm(`Delete promo code ${promo.code}? This cannot be undone.`)) return;
    setActionError(null);
    try {
      const res = await fetch(`${API_URL}/admin/promos/${promo.id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || 'Delete failed');
      }
      await fetchPromos();
    } catch (err) {
      setActionError(err.message);
    }
  };

  const updateForm = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  if (!ready) return <div className="text-av-bone-muted text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl tracking-widest text-av-bone">PROMO CODES</h1>
          <p className="text-av-bone-muted text-xs mt-1">
            {promos.length} code{promos.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => { setShowForm(!showForm); setActionError(null); }}
          className="px-4 py-2 bg-av-red text-av-bone text-xs tracking-widest uppercase hover:bg-av-red-hover transition-colors"
        >
          {showForm ? 'Cancel' : '+ New Code'}
        </button>
      </div>

      {actionError && (
        <div className="px-4 py-3 bg-red-900/30 border border-red-800 text-red-300 text-sm">
          {actionError}
        </div>
      )}

      {/* Create form */}
      {showForm && (
        <form onSubmit={handleCreate} className="border border-av-bone-faint p-6 space-y-4">
          <h2 className="font-heading text-sm tracking-widest text-av-bone mb-2">NEW PROMO CODE</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Code">
              <input
                type="text" required value={form.code}
                onChange={(e) => updateForm('code', e.target.value.toUpperCase())}
                placeholder="FREEDOM15"
                className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone text-sm uppercase outline-none focus:border-av-red"
              />
            </FormField>
            <FormField label="Type">
              <select
                value={form.type}
                onChange={(e) => updateForm('type', e.target.value)}
                className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone text-sm outline-none focus:border-av-red"
              >
                <option value="percentage">Percentage off</option>
                <option value="fixed_amount">Fixed amount off</option>
                <option value="free_shipping">Free shipping</option>
              </select>
            </FormField>
            <FormField label={form.type === 'percentage' ? 'Percent' : form.type === 'fixed_amount' ? 'Dollar amount' : 'N/A'}>
              <input
                type="number" step="0.01" min="0"
                value={form.value}
                onChange={(e) => updateForm('value', e.target.value)}
                disabled={form.type === 'free_shipping'}
                required={form.type !== 'free_shipping'}
                placeholder={form.type === 'percentage' ? '15' : form.type === 'fixed_amount' ? '10.00' : ''}
                className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone text-sm outline-none focus:border-av-red disabled:opacity-30"
              />
            </FormField>
            <FormField label="Min order ($)">
              <input
                type="number" step="0.01" min="0"
                value={form.minOrderAmount}
                onChange={(e) => updateForm('minOrderAmount', e.target.value)}
                placeholder="optional"
                className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone text-sm outline-none focus:border-av-red"
              />
            </FormField>
            <FormField label="Max total uses">
              <input
                type="number" min="1"
                value={form.maxUses}
                onChange={(e) => updateForm('maxUses', e.target.value)}
                placeholder="unlimited"
                className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone text-sm outline-none focus:border-av-red"
              />
            </FormField>
            <FormField label="Max per customer">
              <input
                type="number" min="1"
                value={form.maxUsesPerUser}
                onChange={(e) => updateForm('maxUsesPerUser', e.target.value)}
                placeholder="unlimited"
                className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone text-sm outline-none focus:border-av-red"
              />
            </FormField>
            <FormField label="Starts at">
              <input
                type="datetime-local"
                value={form.startsAt}
                onChange={(e) => updateForm('startsAt', e.target.value)}
                className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone text-sm outline-none focus:border-av-red"
              />
            </FormField>
            <FormField label="Expires at">
              <input
                type="datetime-local"
                value={form.expiresAt}
                onChange={(e) => updateForm('expiresAt', e.target.value)}
                className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone text-sm outline-none focus:border-av-red"
              />
            </FormField>
          </div>
          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="px-6 py-2 bg-av-red text-av-bone text-xs tracking-widest uppercase hover:bg-av-red-hover disabled:opacity-50 transition-colors"
            >
              {saving ? 'Saving…' : 'Create Code'}
            </button>
            <button
              type="button"
              onClick={() => { setShowForm(false); setForm(blankForm); }}
              className="px-6 py-2 border border-av-bone-faint text-av-bone-muted text-xs tracking-widest uppercase hover:border-av-bone transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-av-red text-sm mb-4">{error}</p>
          <button onClick={fetchPromos} className="px-4 py-2 border border-av-red text-av-red text-xs tracking-widest uppercase hover:bg-av-red hover:text-white transition-colors">Try Again</button>
        </div>
      )}

      {!error && loading && <p className="text-av-bone-muted text-sm">Loading promos…</p>}

      {!error && !loading && promos.length === 0 && (
        <p className="text-av-bone-muted text-sm italic py-8 text-center">
          No promo codes yet. Create one above.
        </p>
      )}

      {!error && !loading && promos.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-av-bone-faint text-av-bone-muted text-[10px] tracking-widest uppercase text-left">
                <th className="py-2 pr-2">Code</th>
                <th className="py-2 pr-2">Type</th>
                <th className="py-2 pr-2 text-right">Value</th>
                <th className="py-2 pr-2 text-right">Used</th>
                <th className="py-2 pr-2 text-right">Limit</th>
                <th className="py-2 pr-2">Expires</th>
                <th className="py-2 pr-2 text-center">Active</th>
                <th className="py-2 pr-2"></th>
              </tr>
            </thead>
            <tbody>
              {promos.map((p) => (
                <tr key={p.id} className="border-b border-av-bone-faint hover:bg-av-gunmetal/30">
                  <td className="py-3 pr-2 font-heading text-av-bone tracking-wider">{p.code}</td>
                  <td className="py-3 pr-2 text-av-bone-muted">{TYPE_LABELS[p.type] || p.type}</td>
                  <td className="py-3 pr-2 text-right text-av-bone">{formatValue(p)}</td>
                  <td className="py-3 pr-2 text-right text-av-bone-muted">{p.totalUsages}</td>
                  <td className="py-3 pr-2 text-right text-av-bone-muted">{p.maxUses || '∞'}</td>
                  <td className="py-3 pr-2 text-av-bone-muted text-[10px]">
                    {p.expiresAt ? new Date(p.expiresAt).toLocaleDateString() : '—'}
                  </td>
                  <td className="py-3 pr-2 text-center">
                    <button
                      onClick={() => handleToggleActive(p)}
                      className={`text-[9px] px-2 py-0.5 tracking-widest uppercase transition-colors ${p.isActive ? 'bg-green-900/40 text-green-400 hover:bg-green-900/60' : 'bg-av-bone-dim text-av-bone-muted hover:bg-av-gunmetal'}`}
                    >
                      {p.isActive ? 'Active' : 'Inactive'}
                    </button>
                  </td>
                  <td className="py-3 pr-2 text-right">
                    <button
                      onClick={() => handleDelete(p)}
                      className="text-av-bone-muted text-[10px] tracking-widest uppercase hover:text-av-red"
                    >
                      Delete
                    </button>
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

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}
