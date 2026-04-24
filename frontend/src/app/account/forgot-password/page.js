/**
 * Forgot Password Page — ANTIVAXXER
 *
 * [AV-049] v5.3.5 — sends a password reset email. Backend always returns
 *   a generic success message regardless of whether the email is registered,
 *   so this page also always shows the same success state — never reveals
 *   whether an account exists.
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error?.message || 'Something went wrong. Please try again.');
      }

      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-heading text-3xl tracking-widest text-av-bone mb-6">
            CHECK YOUR EMAIL
          </h1>
          <p className="text-av-bone-muted text-sm font-light leading-relaxed mb-2">
            If an account exists for <strong className="text-av-bone">{email}</strong>,
            we&apos;ve sent a password reset link.
          </p>
          <p className="text-av-bone-muted text-xs font-light leading-relaxed mb-8">
            The link will expire in 1 hour. Check your spam folder if you don&apos;t see it.
          </p>
          <Link
            href="/account/login"
            className="inline-block px-6 py-3 bg-av-red text-av-bone text-xs
                       tracking-widest uppercase hover:bg-av-red-hover transition-colors"
          >
            Back to Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-3xl tracking-widest text-av-bone text-center mb-3">
          FORGOT PASSWORD
        </h1>
        <p className="text-av-bone-muted text-xs font-light text-center mb-8">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-900/30 border border-red-800 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-4 py-3 bg-av-gunmetal border border-av-bone-faint text-av-bone
                         text-sm outline-none focus:border-av-red transition-colors"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-av-red text-av-bone text-xs tracking-widest uppercase
                       hover:bg-av-red-hover disabled:opacity-50 transition-colors"
          >
            {loading ? 'Sending...' : 'Send Reset Link'}
          </button>
        </form>

        <p className="text-av-bone-muted text-xs tracking-wider text-center mt-6">
          Remembered it?{' '}
          <Link href="/account/login" className="text-av-red hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
