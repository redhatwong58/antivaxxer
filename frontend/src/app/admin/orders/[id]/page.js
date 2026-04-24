/**
 * Admin Order Detail Page — ANTIVAXXER
 *
 * [AV-015] feat: admin order management
 * [AV-053] v5.3.7 — line item editing. Edit mode swaps the read-only items
 *   table for editable rows with quantity inputs, remove buttons, and an
 *   "Add Item" variant picker. Save calls PUT /api/admin/orders/:id/items
 *   which atomically restocks removed items, decrements stock for added
 *   items, recalculates totals, and appends an audit note.
 *
 *   Editing is only allowed for pending/paid/processing orders. The backend
 *   enforces this; the UI hides the edit button for shipped+ orders.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAdminAuth } from '@/lib/adminAuth';

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
const EDITABLE_STATUSES = ['pending', 'paid', 'processing'];

export default function AdminOrderDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { ready, getHeaders } = useAdminAuth();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Editable status fields
  const [status, setStatus] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');
  const [notes, setNotes] = useState('');

  // [AV-053] v5.3.7 — line item editing state
  const [editingItems, setEditingItems] = useState(false);
  const [draftItems, setDraftItems] = useState([]); // [{ variantId, quantity, productName, sku, colorName, sizeName, unitPrice, isNew }]
  const [savingItems, setSavingItems] = useState(false);
  const [itemError, setItemError] = useState(null);
  const [showVariantPicker, setShowVariantPicker] = useState(false);
  const [variantSearch, setVariantSearch] = useState('');
  const [allProducts, setAllProducts] = useState([]);
  const [productsLoaded, setProductsLoaded] = useState(false);

  // [AV-056] v5.3.8 — refund state
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundAmount, setRefundAmount] = useState('');
  const [refundReason, setRefundReason] = useState('');
  const [refunding, setRefunding] = useState(false);
  const [refundError, setRefundError] = useState(null);

  // [AV-058] v5.4.0 — Shippo shipping state
  const [shippingRates, setShippingRates] = useState(null); // null = not fetched, [] = fetched but empty
  const [creatingShipment, setCreatingShipment] = useState(false);
  const [purchasingLabel, setPurchasingLabel] = useState(false);
  const [selectedRateId, setSelectedRateId] = useState(null);
  const [shippingError, setShippingError] = useState(null);

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

  // [AV-053] v5.3.7 — line item editing handlers

  const startEditingItems = () => {
    setDraftItems(
      order.items.map((item) => ({
        variantId: item.variantId,
        quantity: item.quantity,
        productName: item.productName,
        sku: item.sku,
        colorName: item.colorName,
        sizeName: item.sizeName,
        unitPrice: item.unitPrice,
        isNew: false,
      }))
    );
    setEditingItems(true);
    setItemError(null);
  };

  const cancelEditingItems = () => {
    setEditingItems(false);
    setDraftItems([]);
    setItemError(null);
    setShowVariantPicker(false);
  };

  const updateDraftQuantity = (variantId, newQty) => {
    const qty = Math.max(1, parseInt(newQty) || 1);
    setDraftItems((items) =>
      items.map((item) => (item.variantId === variantId ? { ...item, quantity: qty } : item))
    );
  };

  const removeDraftItem = (variantId) => {
    setDraftItems((items) => items.filter((item) => item.variantId !== variantId));
  };

  const addDraftItem = (variant, product) => {
    // Refuse to add a duplicate variant — bump quantity instead
    const existing = draftItems.find((item) => item.variantId === variant.id);
    if (existing) {
      updateDraftQuantity(variant.id, existing.quantity + 1);
    } else {
      setDraftItems((items) => [
        ...items,
        {
          variantId: variant.id,
          quantity: 1,
          productName: product.name,
          sku: variant.sku,
          colorName: variant.color || null,
          sizeName: variant.size || null,
          unitPrice: product.basePrice,
          isNew: true,
        },
      ]);
    }
    setShowVariantPicker(false);
    setVariantSearch('');
  };

  // Lazy-load product catalog the first time the picker opens
  const openVariantPicker = async () => {
    setShowVariantPicker(true);
    if (productsLoaded) return;
    try {
      const res = await fetch(`${API_URL}/admin/products`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) {
        setAllProducts(data.products || []);
        setProductsLoaded(true);
      }
    } catch {
      // silent — picker just stays empty, user can close
    }
  };

  const draftSubtotal = draftItems.reduce(
    (sum, item) => sum + Number(item.unitPrice) * item.quantity,
    0
  );
  const draftTotal =
    draftSubtotal -
    Number(order?.discountAmount || 0) +
    Number(order?.shippingAmount || 0) +
    Number(order?.taxAmount || 0);

  const saveItems = async () => {
    if (draftItems.length === 0) {
      setItemError('Order must have at least one item. Cancel the order instead if you want to remove everything.');
      return;
    }
    setSavingItems(true);
    setItemError(null);
    try {
      const res = await fetch(`${API_URL}/admin/orders/${params.id}/items`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({
          items: draftItems.map((item) => ({
            variantId: item.variantId,
            quantity: item.quantity,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to update items');
      }
      setEditingItems(false);
      setDraftItems([]);
      setSuccess('Items updated. ' + (data.diff || []).join('; '));
      await fetchOrder();
    } catch (err) {
      setItemError(err.message);
    } finally {
      setSavingItems(false);
    }
  };

  // [AV-056] v5.3.8 — refund handlers

  const openRefundModal = () => {
    setRefundAmount(order.total.toFixed(2));
    setRefundReason('');
    setRefundError(null);
    setShowRefundModal(true);
  };

  const closeRefundModal = () => {
    setShowRefundModal(false);
    setRefundAmount('');
    setRefundReason('');
    setRefundError(null);
  };

  const submitRefund = async () => {
    setRefundError(null);
    const amount = Number(refundAmount);
    if (!amount || amount <= 0 || amount > order.total) {
      setRefundError(`Amount must be between 0 and $${order.total.toFixed(2)}`);
      return;
    }
    const isFullRefund = Math.abs(amount - order.total) < 0.01;
    const confirmMsg = isFullRefund
      ? `Issue a FULL refund of $${amount.toFixed(2)} for ${order.orderNumber}?\n\nThis will restock all items and mark the order as refunded. This cannot be undone.`
      : `Issue a partial refund of $${amount.toFixed(2)} for ${order.orderNumber}?\n\nItems will NOT be restocked. The order status will remain ${order.status}. This cannot be undone.`;
    if (!confirm(confirmMsg)) return;

    setRefunding(true);
    try {
      const res = await fetch(`${API_URL}/admin/orders/${params.id}/refund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ amount, reason: refundReason || undefined }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error?.message || 'Refund failed');
      }
      setSuccess(`Refunded $${amount.toFixed(2)} via Stripe ${data.refund.stripeRefundId}.`);
      closeRefundModal();
      await fetchOrder();
    } catch (err) {
      setRefundError(err.message);
    } finally {
      setRefunding(false);
    }
  };

  // [AV-058] v5.4.0 — Shippo shipping handlers

  const handleCreateShipment = async () => {
    setCreatingShipment(true);
    setShippingError(null);
    setShippingRates(null);
    setSelectedRateId(null);
    try {
      const res = await fetch(`${API_URL}/admin/orders/${params.id}/shipment`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to create shipment');
      setShippingRates(data.rates || []);
      if (data.rates?.length > 0) setSelectedRateId(data.rates[0].rateId);
    } catch (err) {
      setShippingError(err.message);
    } finally {
      setCreatingShipment(false);
    }
  };

  const handlePurchaseLabel = async () => {
    if (!selectedRateId) {
      setShippingError('Select a rate first');
      return;
    }
    const selectedRate = shippingRates?.find((r) => r.rateId === selectedRateId);
    const confirmMsg = `Purchase a ${selectedRate?.carrier || ''} ${selectedRate?.service || ''} label for $${selectedRate?.amount?.toFixed(2) || '?'}?\n\nThis will charge your Shippo account and automatically mark the order as shipped.`;
    if (!confirm(confirmMsg)) return;

    setPurchasingLabel(true);
    setShippingError(null);
    try {
      const res = await fetch(`${API_URL}/admin/orders/${params.id}/label`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getHeaders() },
        body: JSON.stringify({ rateId: selectedRateId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to purchase label');
      setSuccess(`Label purchased — ${data.label.carrier} ${data.label.service}. Tracking: ${data.label.trackingNumber}`);
      setShippingRates(null);
      await fetchOrder();
    } catch (err) {
      setShippingError(err.message);
    } finally {
      setPurchasingLabel(false);
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
        <div className="flex gap-2">
          {order.stripePaymentIntentId && order.status !== 'refunded' && (
            <button
              onClick={openRefundModal}
              className="px-4 py-2.5 border border-av-red text-av-red text-xs tracking-widest uppercase hover:bg-av-red hover:text-av-bone transition-colors"
            >
              Refund
            </button>
          )}
          <button onClick={handleSave} disabled={saving}
            className="px-6 py-2.5 bg-av-red text-av-bone text-xs tracking-widest uppercase hover:bg-av-red-hover disabled:opacity-50 transition-colors">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
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

      {/* [AV-058] v5.4.0 — Shipping / Label section */}
      {(order.status === 'processing' || order.status === 'paid' || order.labelUrl) && (
        <div className="border border-av-bone-faint p-6 mb-8">
          <h2 className="font-heading text-sm tracking-widest text-av-bone mb-4">SHIPPING</h2>

          {/* If label already purchased — show it */}
          {order.labelUrl && (
            <div className="space-y-3">
              <div className="flex items-center gap-4 flex-wrap">
                <div>
                  <p className="text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">Carrier</p>
                  <p className="text-av-bone text-sm">{order.carrier} {order.carrierService && `· ${order.carrierService}`}</p>
                </div>
                <div>
                  <p className="text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">Tracking</p>
                  {order.trackingUrl ? (
                    <a href={order.trackingUrl} target="_blank" rel="noopener noreferrer" className="text-av-red text-sm hover:underline font-mono">
                      {order.trackingNumber}
                    </a>
                  ) : (
                    <p className="text-av-bone text-sm font-mono">{order.trackingNumber}</p>
                  )}
                </div>
              </div>
              <a
                href={order.labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block px-4 py-2 bg-av-red text-av-bone text-[10px] tracking-widest uppercase hover:bg-av-red-hover transition-colors"
              >
                Download Label (PDF)
              </a>
            </div>
          )}

          {/* If no label yet — show rate flow */}
          {!order.labelUrl && (
            <div>
              {shippingError && (
                <div className="mb-4 px-3 py-2 bg-red-900/30 border border-red-800 text-red-300 text-xs">
                  {shippingError}
                </div>
              )}

              {/* Step 1: Create shipment to get rates */}
              {!shippingRates && (
                <button
                  onClick={handleCreateShipment}
                  disabled={creatingShipment}
                  className="px-4 py-2 bg-av-red text-av-bone text-[10px] tracking-widest uppercase hover:bg-av-red-hover disabled:opacity-50 transition-colors"
                >
                  {creatingShipment ? 'Getting rates…' : 'Get Shipping Rates'}
                </button>
              )}

              {/* Step 2: Select rate + purchase */}
              {shippingRates && shippingRates.length > 0 && (
                <div className="space-y-3">
                  <p className="text-av-bone-muted text-[10px] tracking-widest uppercase">Select a rate</p>
                  <div className="space-y-2">
                    {shippingRates.map((rate) => (
                      <label
                        key={rate.rateId}
                        className={`flex items-center gap-3 px-4 py-3 border cursor-pointer transition-colors ${
                          selectedRateId === rate.rateId
                            ? 'border-av-red bg-av-red/10'
                            : 'border-av-bone-faint hover:border-av-bone'
                        }`}
                      >
                        <input
                          type="radio"
                          name="shippingRate"
                          value={rate.rateId}
                          checked={selectedRateId === rate.rateId}
                          onChange={() => setSelectedRateId(rate.rateId)}
                          className="accent-av-red"
                        />
                        <div className="flex-1">
                          <p className="text-av-bone text-sm">
                            {rate.carrier} — {rate.service}
                          </p>
                          {rate.estimatedDays && (
                            <p className="text-av-bone-muted text-[10px]">
                              Est. {rate.estimatedDays} business day{rate.estimatedDays !== 1 ? 's' : ''}
                            </p>
                          )}
                        </div>
                        <span className="font-heading text-lg text-av-bone">${rate.amount.toFixed(2)}</span>
                      </label>
                    ))}
                  </div>
                  <button
                    onClick={handlePurchaseLabel}
                    disabled={purchasingLabel || !selectedRateId}
                    className="px-6 py-2 bg-av-red text-av-bone text-[10px] tracking-widest uppercase hover:bg-av-red-hover disabled:opacity-50 transition-colors"
                  >
                    {purchasingLabel ? 'Purchasing…' : 'Purchase Label'}
                  </button>
                </div>
              )}

              {/* No rates returned */}
              {shippingRates && shippingRates.length === 0 && (
                <p className="text-av-bone-muted text-sm italic">
                  No shipping rates available. Check the order address and Shippo configuration.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {/* Line Items — read-only or edit mode */}
      <div className="border border-av-bone-faint p-6 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-heading text-sm tracking-widest text-av-bone">
            LINE ITEMS ({editingItems ? draftItems.length : order.items.length})
          </h2>
          {!editingItems && EDITABLE_STATUSES.includes(order.status) && (
            <button
              onClick={startEditingItems}
              className="text-av-bone-muted text-[10px] tracking-widest uppercase hover:text-av-red transition-colors"
            >
              Edit Items
            </button>
          )}
          {!editingItems && !EDITABLE_STATUSES.includes(order.status) && (
            <span className="text-av-bone-muted text-[10px] tracking-widest uppercase italic">
              Locked ({order.status})
            </span>
          )}
        </div>

        {itemError && (
          <div className="mb-4 px-3 py-2 bg-red-900/30 border border-red-800 text-red-300 text-xs">
            {itemError}
          </div>
        )}

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-av-bone-faint">
              <th className="py-2 px-2 text-left text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">Product</th>
              <th className="py-2 px-2 text-left text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">SKU</th>
              <th className="py-2 px-2 text-center text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">Qty</th>
              <th className="py-2 px-2 text-right text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">Price</th>
              <th className="py-2 px-2 text-right text-av-bone-muted text-[10px] tracking-widest uppercase font-normal">Total</th>
              {editingItems && <th className="py-2 px-2"></th>}
            </tr>
          </thead>
          <tbody>
            {!editingItems && order.items.map((item) => (
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
            {editingItems && draftItems.map((item) => (
              <tr key={item.variantId} className="border-b border-av-bone-faint/50">
                <td className="py-2 px-2">
                  <p className="text-av-bone text-sm">
                    {item.productName}
                    {item.isNew && (
                      <span className="ml-2 text-[9px] px-1.5 py-0.5 bg-green-900/40 text-green-400 tracking-widest uppercase">NEW</span>
                    )}
                  </p>
                  <p className="text-av-bone-muted text-[10px]">{[item.colorName, item.sizeName].filter(Boolean).join(' / ')}</p>
                </td>
                <td className="py-2 px-2 text-av-bone-muted font-mono text-xs">{item.sku}</td>
                <td className="py-2 px-2 text-center">
                  <input
                    type="number"
                    min="1"
                    value={item.quantity}
                    onChange={(e) => updateDraftQuantity(item.variantId, e.target.value)}
                    className="w-16 px-2 py-1 bg-av-gunmetal border border-av-bone-faint text-av-bone text-center text-sm outline-none focus:border-av-red"
                  />
                </td>
                <td className="py-2 px-2 text-av-bone text-right">${Number(item.unitPrice).toFixed(2)}</td>
                <td className="py-2 px-2 text-av-bone text-right">${(Number(item.unitPrice) * item.quantity).toFixed(2)}</td>
                <td className="py-2 px-2 text-right">
                  <button
                    onClick={() => removeDraftItem(item.variantId)}
                    className="text-av-bone-muted text-[10px] tracking-widest uppercase hover:text-av-red transition-colors"
                    title="Remove item (will restock)"
                  >
                    Remove
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Add item picker — only in edit mode */}
        {editingItems && (
          <div className="mt-4">
            {!showVariantPicker ? (
              <button
                onClick={openVariantPicker}
                className="text-av-red text-[10px] tracking-widest uppercase hover:text-av-red-hover transition-colors"
              >
                + Add Item
              </button>
            ) : (
              <div className="border border-av-bone-faint p-4 bg-av-gunmetal/30">
                <div className="flex items-center justify-between mb-3">
                  <input
                    type="text"
                    value={variantSearch}
                    onChange={(e) => setVariantSearch(e.target.value)}
                    placeholder="Search by product name or SKU..."
                    className="flex-1 px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone text-xs outline-none focus:border-av-red"
                  />
                  <button
                    onClick={() => { setShowVariantPicker(false); setVariantSearch(''); }}
                    className="ml-3 text-av-bone-muted text-[10px] tracking-widest uppercase hover:text-av-bone"
                  >
                    Cancel
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {!productsLoaded ? (
                    <p className="text-av-bone-muted text-xs italic">Loading products…</p>
                  ) : (
                    allProducts
                      .flatMap((product) =>
                        (product.variants || [])
                          .filter((variant) => {
                            if (!variant.isActive || variant.stockQty <= 0) return false;
                            if (!variantSearch.trim()) return true;
                            const q = variantSearch.toLowerCase();
                            return (
                              product.name.toLowerCase().includes(q) ||
                              variant.sku.toLowerCase().includes(q) ||
                              (variant.color || '').toLowerCase().includes(q) ||
                              (variant.size || '').toLowerCase().includes(q)
                            );
                          })
                          .map((variant) => ({ variant, product }))
                      )
                      .slice(0, 50)
                      .map(({ variant, product }) => (
                        <button
                          key={variant.id}
                          onClick={() => addDraftItem(variant, product)}
                          className="w-full flex items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-av-red/10 border border-av-bone-faint/30 transition-colors"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-av-bone truncate">{product.name}</p>
                            <p className="text-av-bone-muted text-[10px]">
                              {[variant.color, variant.size].filter(Boolean).join(' / ')} · {variant.sku} · {variant.stockQty} in stock
                            </p>
                          </div>
                          <span className="font-heading text-sm text-av-bone whitespace-nowrap">
                            ${Number(product.basePrice).toFixed(2)}
                          </span>
                        </button>
                      ))
                  )}
                  {productsLoaded && allProducts.length === 0 && (
                    <p className="text-av-bone-muted text-xs italic">No products found.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Totals — uses draft when editing */}
        <div className="border-t border-av-bone-faint mt-4 pt-4 max-w-xs ml-auto space-y-1">
          <div className="flex justify-between text-av-bone-muted text-sm">
            <span>Subtotal</span>
            <span>${(editingItems ? draftSubtotal : order.subtotal).toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-av-bone-muted text-sm">
            <span>Shipping</span><span>{order.shippingAmount === 0 ? 'FREE' : `$${order.shippingAmount.toFixed(2)}`}</span>
          </div>
          <div className="flex justify-between text-av-bone-muted text-sm">
            <span>Tax</span><span>{order.taxAmount === 0 ? '—' : `$${order.taxAmount.toFixed(2)}`}</span>
          </div>
          <div className="flex justify-between text-av-bone text-base border-t border-av-bone-faint pt-2">
            <span>Total</span>
            <span>${(editingItems ? draftTotal : order.total).toFixed(2)}</span>
          </div>
        </div>

        {/* Edit mode actions */}
        {editingItems && (
          <div className="flex gap-2 mt-4 justify-end">
            <button
              onClick={cancelEditingItems}
              disabled={savingItems}
              className="px-4 py-2 border border-av-bone-faint text-av-bone-muted text-[10px] tracking-widest uppercase hover:border-av-bone disabled:opacity-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={saveItems}
              disabled={savingItems}
              className="px-4 py-2 bg-av-red text-av-bone text-[10px] tracking-widest uppercase hover:bg-av-red-hover disabled:opacity-50 transition-colors"
            >
              {savingItems ? 'Saving…' : 'Save Items'}
            </button>
          </div>
        )}
      </div>

      {/* [AV-056] v5.3.8 — Refund Modal */}
      {showRefundModal && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={closeRefundModal}
        >
          <div
            className="bg-av-black border border-av-bone-faint max-w-md w-full p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="font-heading text-lg tracking-widest text-av-bone mb-1">ISSUE REFUND</h3>
            <p className="text-av-bone-muted text-xs mb-6">
              Order {order.orderNumber} · Total ${order.total.toFixed(2)}
            </p>

            {refundError && (
              <div className="mb-4 px-3 py-2 bg-red-900/30 border border-red-800 text-red-300 text-xs">
                {refundError}
              </div>
            )}

            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
                  Amount (USD)
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max={order.total}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone text-sm outline-none focus:border-av-red"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    type="button"
                    onClick={() => setRefundAmount(order.total.toFixed(2))}
                    className="text-av-bone-muted text-[9px] tracking-widest uppercase hover:text-av-red"
                  >
                    Full
                  </button>
                  <button
                    type="button"
                    onClick={() => setRefundAmount((order.total / 2).toFixed(2))}
                    className="text-av-bone-muted text-[9px] tracking-widest uppercase hover:text-av-red"
                  >
                    Half
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
                  Reason (optional)
                </label>
                <textarea
                  value={refundReason}
                  onChange={(e) => setRefundReason(e.target.value)}
                  rows={2}
                  placeholder="Customer request, damaged in transit, etc."
                  className="w-full px-3 py-2 bg-av-gunmetal border border-av-bone-faint text-av-bone text-xs outline-none focus:border-av-red resize-none"
                />
              </div>
              <div className="text-[10px] text-av-bone-muted leading-relaxed">
                {Math.abs(Number(refundAmount) - order.total) < 0.01 ? (
                  <span>
                    <strong className="text-av-bone">Full refund</strong> — items will be restocked and order marked refunded.
                  </span>
                ) : (
                  <span>
                    <strong className="text-av-bone">Partial refund</strong> — items will NOT be restocked. Order status stays {order.status}.
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <button
                onClick={closeRefundModal}
                disabled={refunding}
                className="px-4 py-2 border border-av-bone-faint text-av-bone-muted text-[10px] tracking-widest uppercase hover:border-av-bone disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitRefund}
                disabled={refunding}
                className="px-4 py-2 bg-av-red text-av-bone text-[10px] tracking-widest uppercase hover:bg-av-red-hover disabled:opacity-50"
              >
                {refunding ? 'Processing…' : 'Issue Refund'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
