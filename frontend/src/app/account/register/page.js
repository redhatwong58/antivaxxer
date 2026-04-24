/**
 * Register Page — ANTIVAXXER
 *
 * [AV-016] feat: user accounts with NextAuth.js
 */

'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TurnstileWidget from '@/components/auth/TurnstileWidget';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  // [AV-065] v5.4.6 — Turnstile token (empty until widget verifies)
  const [turnstileToken, setTurnstileToken] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (form.password !== form.confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (!turnstileToken) {
      setError('Please complete the verification challenge.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          turnstileToken, // [AV-065] v5.4.6 — bot protection
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || 'Registration failed.');
      }

      // Auto-login after registration
      const result = await signIn('credentials', {
        email: form.email,
        password: form.password,
        turnstileToken, // pass the same token for the login that follows
        redirect: false,
      });

      if (result?.error) {
        router.push('/account/login');
      } else {
        router.push('/account');
        router.refresh();
      }
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  const update = (field, value) => setForm((prev) => ({ ...prev, [field]: value }));

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-3xl tracking-widest text-av-bone text-center mb-8">
          CREATE ACCOUNT
        </h1>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-900/30 border border-red-800 text-red-300 text-sm text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">Name</label>
            <input type="text" value={form.name} onChange={(e) => update('name', e.target.value)} required
              className="w-full px-4 py-3 bg-av-gunmetal border border-av-bone-faint text-av-bone text-sm outline-none focus:border-av-red transition-colors" />
          </div>
          <div>
            <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">Email</label>
            <input type="email" value={form.email} onChange={(e) => update('email', e.target.value)} required
              className="w-full px-4 py-3 bg-av-gunmetal border border-av-bone-faint text-av-bone text-sm outline-none focus:border-av-red transition-colors" />
          </div>
          <div>
            <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">Password</label>
            <input type="password" value={form.password} onChange={(e) => update('password', e.target.value)} required
              className="w-full px-4 py-3 bg-av-gunmetal border border-av-bone-faint text-av-bone text-sm outline-none focus:border-av-red transition-colors" />
          </div>
          <div>
            <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">Confirm Password</label>
            <input type="password" value={form.confirm} onChange={(e) => update('confirm', e.target.value)} required
              className="w-full px-4 py-3 bg-av-gunmetal border border-av-bone-faint text-av-bone text-sm outline-none focus:border-av-red transition-colors" />
          </div>
          {/* [AV-065] v5.4.6 — Cloudflare Turnstile bot challenge */}
          <TurnstileWidget onVerify={setTurnstileToken} />
          <button type="submit" disabled={loading || !turnstileToken}
            className="w-full py-3 bg-av-red text-av-bone text-xs tracking-widest uppercase hover:bg-av-red-hover disabled:opacity-50 transition-colors">
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-av-bone-muted text-xs tracking-wider text-center mt-6">
          Already have an account?{' '}
          <Link href="/account/login" className="text-av-red hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
