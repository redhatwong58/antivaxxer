/**
 * Admin Failed Webhooks Page — ANTIVAXXER
 *
 * [AV-057] v5.3.9 — dead-letter queue recovery UI for webhook failures.
 *   Lists unresolved failed webhooks with: source, event type, event ID,
 *   error message, retry count, created at. Admin can:
 *     - View full payload (expanded row)
 *     - Retry: replay through the handler
 *     - Resolve: mark resolved without retry (manual fix)
 *
 *   Critical for production operations — without this page, the DLQ would
 *   be a black box. Wired into the admin sidebar in AdminSidebar.js.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminAuth } from '@/lib/adminAuth';

const fmtDate = (iso) => new Date(iso).toLocaleString('en-US', {
  month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit',
});

export default function AdminFailedWebhooksPage() {
  const { ready, getHeaders } = useAdminAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [expandedPayload, setExpandedPayload] = useState(null);
  const [loadingPayload, setLoadingPayload] = useState(false);
  const [showResolved, setShowResolved] = useState(false);
  const [retrying, setRetrying] = useState(null); // id currently being retried

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  const fetchItems = useCallback(async () => {
    if (!ready) return;
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (showResolved) params.set('resolved', 'true');
      const res = await fetch(`${API_URL}/admin/failed-webhooks?${params}`, { headers: getHeaders() });
      if (res.status === 401 || res.status === 403) {
        setError('Admin access denied.');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Failed to load DLQ');
      setItems(data.items || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_URL, ready, getHeaders, showResolved]);

  useEffect(() => { if (ready) fetchItems(); }, [ready, fetchItems]);

  const toggleExpand = async (item) => {
    if (expandedId === item.id) {
      setExpandedId(null);
      setExpandedPayload(null);
      return;
    }
    setExpandedId(item.id);
    setExpandedPayload(null);
    setLoadingPayload(true);
    try {
      const res = await fetch(`${API_URL}/admin/failed-webhooks/${item.id}`, { headers: getHeaders() });
      const data = await res.json();
      if (res.ok) setExpandedPayload(data.item?.payload || null);
    } catch {
      // silent — expanded view just won't show payload
    } finally {
      setLoadingPayload(false);
    }
  };

  const handleRetry = async (item) => {
    if (!confirm(`Retry webhook event ${item.eventId}?\n\nThis will replay the original event through the handler. If it succeeds, the entry will be marked resolved. If it fails again, the retry count will increment.`)) return;
    setActionError(null);
    setRetrying(item.id);
    try {
      const res = await fetch(`${API_URL}/admin/failed-webhooks/${item.id}/retry`, {
        method: 'POST',
        headers: getHeaders(),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error?.message || 'Retry failed');
      await fetchItems();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setRetrying(null);
    }
  };

  const handleResolve = async (item) => {
    if (!confirm(`Mark ${item.eventId} as resolved WITHOUT retrying?\n\nUse this if you fixed the underlying problem manually (e.g. promoted the user to admin, edited the order directly, etc.). This just removes the entry from the active DLQ.`)) return;
    setActionError(null);
    try {
      const res = await fetch(`${API_URL}/admin/failed-webhooks/${item.id}/resolve`, {
        method: 'POST',
        headers: getHeaders(),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || 'Resolve failed');
      }
      await fetchItems();
    } catch (err) {
      setActionError(err.message);
    }
  };

  if (!ready) return <div className="text-av-bone-muted text-sm">Loading…</div>;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl tracking-widest text-av-bone">FAILED WEBHOOKS</h1>
          <p className="text-av-bone-muted text-xs mt-1">
            Dead-letter queue · {items.length} {showResolved ? 'total' : 'unresolved'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowResolved(!showResolved)}
            className={`px-3 py-2 text-[10px] tracking-widest uppercase border transition-colors ${
              showResolved
                ? 'bg-av-red border-av-red text-av-bone'
                : 'border-av-bone-faint text-av-bone-muted hover:border-av-bone'
            }`}
          >
            {showResolved ? 'Showing all' : 'Unresolved only'}
          </button>
          <button
            onClick={fetchItems}
            className="px-3 py-2 border border-av-bone-faint text-av-bone-muted text-[10px] tracking-widest uppercase hover:border-av-bone transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {actionError && (
        <div className="px-4 py-3 bg-red-900/30 border border-red-800 text-red-300 text-sm">
          {actionError}
        </div>
      )}

      {error && (
        <div className="text-center py-12">
          <p className="text-av-red text-sm mb-4">{error}</p>
          <button onClick={fetchItems} className="px-4 py-2 border border-av-red text-av-red text-xs tracking-widest uppercase hover:bg-av-red hover:text-av-bone transition-colors">
            Try Again
          </button>
        </div>
      )}

      {!error && loading && <p className="text-av-bone-muted text-sm">Loading…</p>}

      {!error && !loading && items.length === 0 && (
        <div className="border border-av-bone-faint p-8 text-center">
          <p className="text-av-bone-muted text-sm mb-2">
            {showResolved ? 'No webhook events have failed.' : 'No unresolved failures. Good.'}
          </p>
          <p className="text-av-bone-muted text-[10px] tracking-wider uppercase">
            This is where failed Stripe webhooks land for manual recovery.
          </p>
        </div>
      )}

      {!error && !loading && items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => {
            const isExpanded = expandedId === item.id;
            const isRetrying = retrying === item.id;
            return (
              <div
                key={item.id}
                className={`border ${item.resolved ? 'border-green-900/40' : 'border-av-bone-faint'}`}
              >
                {/* Row header */}
                <div className="flex items-center gap-4 px-4 py-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[9px] px-2 py-0.5 tracking-widest uppercase bg-av-gunmetal text-av-bone-muted">
                        {item.source}
                      </span>
                      <span className="text-av-bone text-xs font-mono">{item.eventType}</span>
                      {item.resolved && (
                        <span className="text-[9px] px-2 py-0.5 tracking-widest uppercase bg-green-900/40 text-green-400">
                          resolved
                        </span>
                      )}
                      {item.retryCount > 0 && (
                        <span className="text-[9px] px-2 py-0.5 tracking-widest uppercase bg-yellow-900/40 text-yellow-400">
                          retried {item.retryCount}×
                        </span>
                      )}
                    </div>
                    <p className="text-av-bone-muted text-[11px] font-mono truncate mb-1">
                      {item.eventId}
                    </p>
                    <p className="text-red-300 text-xs truncate">{item.errorMessage}</p>
                  </div>
                  <div className="text-right text-[10px] text-av-bone-muted whitespace-nowrap">
                    <p>{fmtDate(item.createdAt)}</p>
                    {item.resolved && item.resolvedBy && (
                      <p className="text-green-400 mt-1">by {item.resolvedBy}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleExpand(item)}
                      className="text-av-bone-muted text-[10px] tracking-widest uppercase hover:text-av-bone transition-colors px-2"
                    >
                      {isExpanded ? 'Hide' : 'View'}
                    </button>
                    {!item.resolved && (
                      <>
                        <button
                          onClick={() => handleRetry(item)}
                          disabled={isRetrying}
                          className="text-av-red text-[10px] tracking-widest uppercase hover:text-av-red-hover disabled:opacity-50 transition-colors px-2"
                        >
                          {isRetrying ? 'Retrying…' : 'Retry'}
                        </button>
                        <button
                          onClick={() => handleResolve(item)}
                          className="text-av-bone-muted text-[10px] tracking-widest uppercase hover:text-green-400 transition-colors px-2"
                        >
                          Resolve
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Expanded payload view */}
                {isExpanded && (
                  <div className="border-t border-av-bone-faint bg-av-black/50 p-4">
                    <p className="text-av-bone-muted text-[10px] tracking-widest uppercase mb-2">Full error</p>
                    <pre className="text-red-300 text-xs whitespace-pre-wrap break-words mb-4">{item.errorMessage}</pre>
                    <p className="text-av-bone-muted text-[10px] tracking-widest uppercase mb-2">Event payload</p>
                    {loadingPayload ? (
                      <p className="text-av-bone-muted text-xs italic">Loading payload…</p>
                    ) : expandedPayload ? (
                      <pre className="text-av-bone text-[10px] font-mono bg-av-gunmetal p-3 max-h-96 overflow-auto whitespace-pre-wrap break-words">
                        {JSON.stringify(expandedPayload, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-av-bone-muted text-xs italic">No payload available.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
