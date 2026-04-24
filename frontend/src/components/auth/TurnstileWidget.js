/**
 * Cloudflare Turnstile Widget — ANTIVAXXER
 *
 * [AV-065] v5.4.6 — vanilla integration, no extra npm dependency.
 * Loads the Turnstile script once per page and renders a widget into
 * a div ref. Calls onVerify(token) when the user passes the challenge.
 *
 * Graceful degradation: if NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set,
 * the component renders nothing and immediately calls onVerify('') so
 * forms remain submittable in dev. The backend middleware also degrades
 * gracefully when TURNSTILE_SECRET_KEY is unset.
 *
 * Usage:
 *   <TurnstileWidget onVerify={(token) => setTurnstileToken(token)} />
 *
 * Then include the token in the form submission body or X-Turnstile-Token header.
 */

'use client';

import { useEffect, useRef, useState } from 'react';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js';

// Track script load state across component instances
let scriptLoadPromise = null;
function loadTurnstileScript() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.turnstile) return Promise.resolve();
  if (scriptLoadPromise) return scriptLoadPromise;

  scriptLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${SCRIPT_URL}"]`);
    if (existing) {
      existing.addEventListener('load', () => resolve());
      return;
    }
    const script = document.createElement('script');
    script.src = SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Turnstile script failed to load'));
    document.head.appendChild(script);
  });
  return scriptLoadPromise;
}

export default function TurnstileWidget({ onVerify, theme = 'dark' }) {
  const containerRef = useRef(null);
  const widgetIdRef = useRef(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Dev mode: no site key configured → skip widget, immediately "verify"
    if (!SITE_KEY) {
      onVerify('dev-mode-no-turnstile');
      return;
    }

    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme,
          callback: (token) => onVerify(token),
          'error-callback': () => setError('Verification failed. Please refresh.'),
          'expired-callback': () => onVerify(''), // force re-verify
        });
      })
      .catch((err) => {
        // Cloudflare unreachable — backend will allow through (graceful degradation)
        console.warn('[Turnstile] script load failed:', err.message);
        onVerify('script-load-failed');
      });

    return () => {
      cancelled = true;
      if (widgetIdRef.current && window.turnstile) {
        try { window.turnstile.remove(widgetIdRef.current); } catch {}
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!SITE_KEY) return null; // dev mode renders nothing

  return (
    <div className="my-4">
      <div ref={containerRef} />
      {error && <p className="text-red-400 text-xs mt-2">{error}</p>}
    </div>
  );
}
