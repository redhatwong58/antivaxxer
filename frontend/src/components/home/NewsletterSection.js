/**
 * Newsletter Signup Section — email capture above footer
 * [AV-037] new: v5.2.0 UI overhaul
 * [AV-061] v5.4.2 — honesty fix: check res.ok, show real errors, allow retry
 * Submits to existing /api/newsletter/subscribe endpoint.
 */
'use client';
import { useState } from 'react';
export default function NewsletterSection() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null); // { ok: bool, message: string }
  const [submitting, setSubmitting] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    setStatus(null);
    try {
      const res = await fetch(`${API_URL}/newsletter/subscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.subscribed) {
        setStatus({ ok: true, message: data.message || 'Subscribed!' });
        setEmail('');
      } else {
        setStatus({ ok: false, message: data.message || 'Something went wrong. Try again.' });
      }
    } catch {
      setStatus({ ok: false, message: 'Connection issue. Please try again.' });
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <section className="py-24 px-10 text-center border-t border-av-bone-faint">
      <h2 className="font-heading text-5xl tracking-[4px] mb-3">JOIN THE MOVEMENT</h2>
      <p className="font-light text-sm text-av-bone-muted tracking-wider mb-9">
        New drops, exclusive codes, and content. No spam. Unsubscribe anytime.
      </p>
      {status?.ok ? (
        <p className="text-av-red font-heading text-lg tracking-wider">{status.message}</p>
      ) : (
        <div>
          <form onSubmit={handleSubmit} className="flex max-w-[500px] mx-auto">
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com" required disabled={submitting}
              className="flex-1 px-5 py-4 bg-transparent border border-av-bone-dim text-av-bone
                         text-sm font-light outline-none focus:border-av-red placeholder:text-av-bone-muted
                         disabled:opacity-50" />
            <button type="submit" disabled={submitting}
              className="px-8 py-4 bg-av-red border border-av-red text-av-bone font-heading
                         text-sm tracking-[3px] cursor-pointer hover:bg-av-red-hover transition-colors
                         disabled:opacity-50">
              {submitting ? '...' : 'SUBSCRIBE'}
            </button>
          </form>
          {status && !status.ok && (
            <p className="text-red-400 text-xs mt-3">{status.message}</p>
          )}
        </div>
      )}
    </section>
  );
}
