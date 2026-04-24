/**
 * Reset Password Page — ANTIVAXXER
 *
 * [AV-049] v5.3.5 — accepts token from URL, lets user choose a new password.
 *   The token is validated server-side; expired/invalid tokens get a clear
 *   error and a link to request a new one.
 *
 * Route: /account/reset-password/[token]
 */

'use client';

import { useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

export default function ResetPasswordPage() {
  const router = useRouter();
  const params = useParams();
  const token = params?.token;

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Reset link is missing or malformed.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data?.error?.message || 'Password reset failed.');
      }

      setSuccess(true);
      // After 2.5s, kick them to login
      setTimeout(() => router.push('/account/login'), 2500);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="w-full max-w-sm text-center">
          <h1 className="font-heading text-3xl tracking-widest text-av-bone mb-6">
            PASSWORD UPDATED
          </h1>
          <p className="text-av-bone-muted text-sm font-light leading-relaxed mb-8">
            Your password has been changed. Redirecting you to sign in...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-3xl tracking-widest text-av-bone text-center mb-3">
          NEW PASSWORD
        </h1>
        <p className="text-av-bone-muted text-xs font-light text-center mb-8">
          Choose a new password for your account.
        </p>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-900/30 border border-red-800 text-red-300 text-sm text-center">
            {error}
            {(error.includes('expired') || error.includes('invalid')) && (
              <div className="mt-2">
                <Link href="/account/forgot-password" className="text-av-red underline">
                  Request a new link
                </Link>
              </div>
            )}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              className="w-full px-4 py-3 bg-av-gunmetal border border-av-bone-faint text-av-bone
                         text-sm outline-none focus:border-av-red transition-colors"
            />
          </div>
          <div>
            <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
              Confirm Password
            </label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
              autoComplete="new-password"
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
            {loading ? 'Updating...' : 'Update Password'}
          </button>
        </form>

        <p className="text-av-bone-muted text-xs tracking-wider text-center mt-6">
          <Link href="/account/login" className="text-av-red hover:underline">
            Back to sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
