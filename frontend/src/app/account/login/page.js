/**
 * Login Page — ANTIVAXXER
 *
 * [AV-016] feat: user accounts with NextAuth.js
 */

'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import TurnstileWidget from '@/components/auth/TurnstileWidget';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  // [AV-065] v5.4.6
  const [turnstileToken, setTurnstileToken] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!turnstileToken) {
      setError('Please complete the verification challenge.');
      return;
    }
    setLoading(true);
    setError(null);

    const result = await signIn('credentials', {
      email,
      password,
      turnstileToken, // [AV-065] forwarded by NextAuth authorize() to /api/auth/login
      redirect: false,
    });

    if (result?.error) {
      setError('Invalid email or password.');
      setLoading(false);
    } else {
      router.push('/account');
      router.refresh();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <h1 className="font-heading text-3xl tracking-widest text-av-bone text-center mb-8">
          LOG IN
        </h1>

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
              className="w-full px-4 py-3 bg-av-gunmetal border border-av-bone-faint text-av-bone
                         text-sm outline-none focus:border-av-red transition-colors"
            />
          </div>
          <div>
            <label className="block text-av-bone-muted text-[10px] tracking-widest uppercase mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-3 bg-av-gunmetal border border-av-bone-faint text-av-bone
                         text-sm outline-none focus:border-av-red transition-colors"
            />
            <div className="text-right mt-1">
              <Link
                href="/account/forgot-password"
                className="text-av-bone-muted text-[10px] tracking-wider uppercase hover:text-av-red transition-colors"
              >
                Forgot password?
              </Link>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading || !turnstileToken}
            className="w-full py-3 bg-av-red text-av-bone text-xs tracking-widest uppercase
                       hover:bg-av-red-hover disabled:opacity-50 transition-colors"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
          {/* [AV-065] v5.4.6 — bot protection */}
          <TurnstileWidget onVerify={setTurnstileToken} />
        </form>

        <p className="text-av-bone-muted text-xs tracking-wider text-center mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/account/register" className="text-av-red hover:underline">
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}
