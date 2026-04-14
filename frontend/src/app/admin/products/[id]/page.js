/**
 * Admin Product Editor — ANTIVAXXER
 *
 * [AV-009] feat: admin product editor with variant matrix and S3 upload
 *
 * Edit existing product: info fields, color/size selectors,
 * variant matrix with inline stock editing.
 *
 * Image upload requires AWS S3 credentials — stubbed until configured.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/adminAuth';

export default function ProductEditorPage() {
  const params = useParams();
  const router = useRouter();
  const { ready, getHeaders } = useAdminAuth();
  const productId = params.id;
  const isNew = productId === 'new';

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Form state
  const [form, setForm] = useState({
    name: '', slug: '', categoryId: '', basePrice: '', comparePrice: '',
    description: '', variantLabel: '', badge: '', status: 'draft', featured: false,
  });
  const [selectedColorIds, setSelectedColorIds] = useState([]);
  const [selectedSizeIds, setSelectedSizeIds] = useState([]);
  const [variants, setVariants] = useState([]);

  // Options from API
  const [options, setOptions] = useState({ colors: [], sizes: [], categories: [] });

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  // Fetch product data (edit mode) or options (new mode)
  const fetchData = useCallback(async () => {
    if (!ready) return;
    setLoading(true);

    try {
      if (isNew) {
        const res = await fetch(`${API_URL}/admin/options`, {
          headers: getHeaders(),
        });
        if (!res.ok) throw new Error('Failed to load form options');
        const data = await res.json();
        setOptions(data);
      } else {
        const res = await fetch(`${API_URL}/admin/products/${productId}`, {
          headers: getHeaders(),
        });
        if (res.status === 401 || res.status === 403) { setError('Admin access denied.'); return; }
        if (!res.ok) throw new Error('Failed to load product');
        const data = await res.json();

        setForm({
          name: data.product.name,
          slug: data.product.slug,
          categoryId: data.product.categoryId,
          basePrice: data.product.basePrice,
          comparePrice: data.product.comparePrice || '',
          description: data.product.description || '',
          variantLabel: data.product.variantLabel || '',
          badge: data.product.badge || '',
          status: data.product.status,
          featured: data.product.featured,
        });
        setSelectedColorIds(data.product.colors.map((c) => c.id));
        setSelectedSizeIds(data.product.sizes.map((s) => s.id));
        setVariants(data.product.variants);
        setOptions(data.options);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_URL, ready, productId, isNew, router, getHeaders]);

  useEffect(() => {
    if (ready) fetchData();
  }, [ready, fetchData]);

  // Auto-generate slug from name
  const handleNameChange = (name) => {
    setForm((prev) => ({
      ...prev,
      name,
      slug: isNew
        ? name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
        : prev.slug,
    }));
  };

  // Update form field
  const updateField = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  // Toggle color/size selection
  const toggleColor = (colorId) => {
    setSelectedColorIds((prev) =>
      prev.includes(colorId) ? prev.filter((id) => id !== colorId) : [...prev, colorId]
    );
  };
  const toggleSize = (sizeId) => {
    setSelectedSizeIds((prev) =>
      prev.includes(sizeId) ? prev.filter((id) => id !== sizeId) : [...prev, sizeId]
    );
  };

  // Update variant field inline
  const updateVariant = (index, field, value) => {
    setVariants((prev) =>
      prev.map((v, i) => (i === index ? { ...v, [field]: value } : v))
    );
  };

  // Save product
  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const body = {
        ...form,
        basePrice: parseFloat(form.basePrice) || 0,
        comparePrice: form.comparePrice ? parseFloat(form.comparePrice) : null,
        badge: form.badge || null,
        colorIds: selectedColorIds,
        sizeIds: selectedSizeIds,
      };

      const method = isNew ? 'POST' : 'PUT';
      const url = isNew ? `${API_URL}/admin/products` : `${API_URL}/admin/products/${productId}`;

      const res = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...getHeaders(),
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Save failed');

      // If editing and variants changed, save them too
      if (!isNew && variants.length > 0) {
        const varRes = await fetch(`${API_URL}/admin/products/${productId}/variants`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            ...getHeaders(),
          },
          body: JSON.stringify({ variants }),
        });
        if (!varRes.ok) {
          const varData = await varRes.json();
          throw new Error(varData?.error?.message || 'Variant save failed');
        }
      }

      setSuccess(isNew ? 'Product created.' : 'Product saved.');

      if (isNew && data.product?.id) {
        router.push(`/admin/products/${data.product.id}`);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-20">
        <p className="text-av-bone-muted text-sm tracking-wider">Loading editor...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <button
            onClick={() => router.push('/admin')}
            className="text-av-bone-muted text-xs tracking-wider hover:text-av-bone transition-colors mb-2"
          >
            ← Back to Products
          </button>
          <h1 className="font-heading text-2xl tracking-widest text-av-bone">
            {isNew ? 'NEW PRODUCT' : 'EDIT PRODUCT'}
          </h1>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2.5 bg-av-red text-av-bone text-xs tracking-widest uppercase
                     hover:bg-av-red-hover disabled:opacity-50 transition-colors"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>

      {/* Messages */}
      {error && (
        <div className="mb-6 px-4 py-3 bg-red-900/30 border border-red-800 text-red-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="mb-6 px-4 py-3 bg-green-900/30 border border-green-800 text-green-300 text-sm">
          {success}
        </div>
      )}

      <div className="space-y-8">
        {/* Basic Info */}
        <section className="border border-av-bone-faint p-6">
          <h2 className="font-heading text-sm tracking-widest text-av-bone mb-4">
            PRODUCT INFO
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
                Name *
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => handleNameChange(e.target.value)}
                className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone
                           text-sm outline-none focus:border-av-red transition-colors"
              />
            </div>
            <div>
              <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
                Slug *
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={(e) => updateField('slug', e.target.value)}
                className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone
                           text-sm outline-none focus:border-av-red transition-colors font-mono"
              />
            </div>
            <div>
              <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
                Category *
              </label>
              <select
                value={form.categoryId}
                onChange={(e) => updateField('categoryId', e.target.value)}
                className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone
                           text-sm outline-none focus:border-av-red transition-colors"
              >
                <option value="">Select category</option>
                {options.categories.map((cat) => (
                  <option key={cat.id} value={cat.id}>{cat.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
                Badge
              </label>
              <select
                value={form.badge}
                onChange={(e) => updateField('badge', e.target.value)}
                className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone
                           text-sm outline-none focus:border-av-red transition-colors"
              >
                <option value="">None</option>
                <option value="BESTSELLER">BESTSELLER</option>
                <option value="NEW">NEW</option>
                <option value="HOT">HOT</option>
                <option value="COLLAB">COLLAB</option>
              </select>
            </div>
            <div>
              <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
                Base Price *
              </label>
              <input
                type="number"
                step="0.01"
                value={form.basePrice}
                onChange={(e) => updateField('basePrice', e.target.value)}
                className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone
                           text-sm outline-none focus:border-av-red transition-colors"
              />
            </div>
            <div>
              <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
                Compare Price
              </label>
              <input
                type="number"
                step="0.01"
                value={form.comparePrice}
                onChange={(e) => updateField('comparePrice', e.target.value)}
                placeholder="Original price (for sale display)"
                className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone
                           text-sm outline-none focus:border-av-red transition-colors
                           placeholder:text-av-bone-muted/30"
              />
            </div>
            <div>
              <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) => updateField('status', e.target.value)}
                className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone
                           text-sm outline-none focus:border-av-red transition-colors"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-5">
              <input
                type="checkbox"
                checked={form.featured}
                onChange={(e) => updateField('featured', e.target.checked)}
                className="accent-av-red"
                id="featured"
              />
              <label htmlFor="featured" className="text-av-bone-muted text-xs tracking-wider">
                Featured product
              </label>
            </div>
          </div>
          <div className="mt-4">
            <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
              Description
            </label>
            <textarea
              value={form.description}
              onChange={(e) => updateField('description', e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone
                         text-sm outline-none focus:border-av-red transition-colors resize-y"
            />
          </div>
          <div className="mt-4">
            <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
              Variant Label
            </label>
            <input
              type="text"
              value={form.variantLabel}
              onChange={(e) => updateField('variantLabel', e.target.value)}
              placeholder="e.g. Comfort Colors 1717 · Heavyweight"
              className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone
                         text-sm outline-none focus:border-av-red transition-colors
                         placeholder:text-av-bone-muted/30"
            />
          </div>
        </section>

        {/* Colors */}
        <section className="border border-av-bone-faint p-6">
          <h2 className="font-heading text-sm tracking-widest text-av-bone mb-4">
            AVAILABLE COLORS
          </h2>
          <div className="flex flex-wrap gap-3">
            {options.colors.map((color) => (
              <button
                key={color.id}
                onClick={() => toggleColor(color.id)}
                className={`flex items-center gap-2 px-3 py-2 border text-xs tracking-wider
                           transition-all ${
                  selectedColorIds.includes(color.id)
                    ? 'border-av-bone text-av-bone bg-av-bone/10'
                    : 'border-av-bone-faint text-av-bone-muted hover:border-av-bone-dim'
                }`}
              >
                <span
                  className="w-4 h-4 rounded-full border border-av-bone-dim"
                  style={{ backgroundColor: color.hexCode }}
                />
                {color.name}
              </button>
            ))}
          </div>
        </section>

        {/* Sizes */}
        <section className="border border-av-bone-faint p-6">
          <h2 className="font-heading text-sm tracking-widest text-av-bone mb-4">
            AVAILABLE SIZES
          </h2>
          <div className="flex flex-wrap gap-2">
            {options.sizes.map((size) => (
              <button
                key={size.id}
                onClick={() => toggleSize(size.id)}
                className={`w-12 h-10 flex items-center justify-center text-xs tracking-wider
                           border transition-all ${
                  selectedSizeIds.includes(size.id)
                    ? 'border-av-bone text-av-bone bg-av-bone/10'
                    : 'border-av-bone-faint text-av-bone-muted hover:border-av-bone-dim'
                }`}
              >
                {size.name}
              </button>
            ))}
          </div>
        </section>

        {/* Variant Matrix (edit mode only) */}
        {!isNew && variants.length > 0 && (
          <section className="border border-av-bone-faint p-6">
            <h2 className="font-heading text-sm tracking-widest text-av-bone mb-4">
              VARIANT MATRIX — {variants.length} SKUs
            </h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-av-bone-faint">
                    <th className="text-left py-2 px-2 text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">SKU</th>
                    <th className="text-left py-2 px-2 text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">Color</th>
                    <th className="text-left py-2 px-2 text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">Size</th>
                    <th className="text-right py-2 px-2 text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">Stock</th>
                    <th className="text-right py-2 px-2 text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">Price Override</th>
                    <th className="text-center py-2 px-2 text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">Active</th>
                  </tr>
                </thead>
                <tbody>
                  {variants.map((v, i) => (
                    <tr key={v.id || i} className="border-b border-av-bone-faint/50">
                      <td className="py-2 px-2 text-av-bone font-mono text-xs">{v.sku}</td>
                      <td className="py-2 px-2 text-av-bone-muted text-xs">{v.color?.name || '—'}</td>
                      <td className="py-2 px-2 text-av-bone-muted text-xs">{v.size?.name || '—'}</td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          min="0"
                          value={v.stockQty}
                          onChange={(e) => updateVariant(i, 'stockQty', parseInt(e.target.value) || 0)}
                          className="w-20 px-2 py-1 bg-av-gunmetal border border-av-bone-faint text-av-bone
                                     text-xs text-right outline-none focus:border-av-red"
                        />
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="number"
                          step="0.01"
                          value={v.priceOverride || ''}
                          onChange={(e) => updateVariant(i, 'priceOverride', e.target.value ? parseFloat(e.target.value) : null)}
                          placeholder={form.basePrice ? `$${form.basePrice}` : '—'}
                          className="w-24 px-2 py-1 bg-av-gunmetal border border-av-bone-faint text-av-bone
                                     text-xs text-right outline-none focus:border-av-red
                                     placeholder:text-av-bone-muted/30"
                        />
                      </td>
                      <td className="py-2 px-2 text-center">
                        <input
                          type="checkbox"
                          checked={v.isActive}
                          onChange={(e) => updateVariant(i, 'isActive', e.target.checked)}
                          className="accent-av-red"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Images — stubbed until S3 is configured */}
        <section className="border border-av-bone-faint p-6">
          <h2 className="font-heading text-sm tracking-widest text-av-bone mb-4">
            PRODUCT IMAGES
          </h2>
          <div className="text-center py-8 border border-dashed border-av-bone-faint">
            <p className="text-av-bone-muted text-sm mb-2">
              Image upload requires AWS S3 credentials.
            </p>
            <p className="text-av-bone-muted text-[10px] tracking-wider">
              Configure AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and S3_BUCKET_NAME in .env
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
