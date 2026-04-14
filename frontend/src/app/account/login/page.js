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

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const result = await signIn('credentials', {
      email,
      password,
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
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-av-red text-av-bone text-xs tracking-widest uppercase
                       hover:bg-av-red-hover disabled:opacity-50 transition-colors"
          >
            {loading ? 'Logging in...' : 'Log In'}
          </button>
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
