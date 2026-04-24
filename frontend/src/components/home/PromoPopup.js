/**
 * Promo Popup — modal on first visit with discount code + email capture
 * [AV-037] new: v5.2.0 UI overhaul
 * Shows once per session (sessionStorage). Submits to newsletter endpoint.
 * To remove: delete this file, remove from layout.js
 */
'use client';
import { useState, useEffect } from 'react';
export default function PromoPopup() {
  const [visible, setVisible] = useState(false);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (sessionStorage.getItem('av_promo_seen')) return;
    const timer = setTimeout(() => setVisible(true), 2000);
    return () => clearTimeout(timer);
  }, []);

  const close = () => { setVisible(false); sessionStorage.setItem('av_promo_seen', '1'); };
  // [AV-061] v5.4.2 — honesty fix: check res.ok before showing success
  const [submitError, setSubmitError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) return;
    setSubmitError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/newsletter/subscribe`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok && data.subscribed) {
        setSubmitted(true);
        setTimeout(close, 2000);
      } else {
        setSubmitError(data.message || 'Something went wrong. Try again.');
      }
    } catch {
      setSubmitError('Connection issue. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;
  return (
    <div className="fixed inset-0 bg-black/70 z-[500] flex items-center justify-center"
         onClick={close}>
      <div className="bg-av-black border border-av-red max-w-[520px] w-[90%] p-12 text-center relative"
           onClick={(e) => e.stopPropagation()}>
        <button onClick={close} className="absolute top-3.5 right-4 text-av-bone-muted text-xl
                                           hover:text-av-red transition-colors bg-transparent border-none cursor-pointer">✕</button>
        <span className="inline-block bg-av-red px-4 py-1 font-heading text-xs tracking-[3px] mb-5">LAUNCH OFFER</span>
        <h2 className="font-heading text-[42px] tracking-[4px] leading-tight mb-2">
          15% OFF YOUR<br />FIRST ORDER
        </h2>
        <p className="text-sm text-av-bone-muted font-light tracking-wider mb-7">
          Join the movement. Get the code.
        </p>
        <div className="inline-block border-2 border-dashed border-av-red px-8 py-3 font-heading
                        text-[28px] tracking-[6px] text-av-red mb-6">
          FREEDOM15
        </div>
        {submitted ? (
          <p className="text-av-red font-heading text-lg tracking-wider">Welcome to the movement.</p>
        ) : (
          <div>
            <form onSubmit={handleSubmit} className="flex max-w-[380px] mx-auto mb-2">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email" required disabled={submitting}
                className="flex-1 px-4 py-3.5 bg-transparent border border-av-bone-dim text-av-bone
                           text-sm font-light outline-none focus:border-av-red placeholder:text-av-bone-muted
                           disabled:opacity-50" />
              <button type="submit" disabled={submitting}
                className="px-6 py-3.5 bg-av-red border border-av-red text-av-bone font-heading
                           text-sm tracking-[3px] cursor-pointer hover:bg-av-red-hover transition-colors
                           disabled:opacity-50">
                {submitting ? '...' : 'GET CODE'}
              </button>
            </form>
            {submitError && (
              <p className="text-red-400 text-[11px] text-center mb-2">{submitError}</p>
            )}
          </div>
        )}
        <p className="text-[11px] text-av-bone-muted font-light">No spam. Unsubscribe anytime.</p>
      </div>
    </div>
  );
}
