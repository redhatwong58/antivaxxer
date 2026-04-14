/**
 * Account Dashboard — ANTIVAXXER
 *
 * [AV-016] feat: user accounts with NextAuth.js
 */

'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';

export default function AccountPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/account/login');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-av-bone-muted text-sm tracking-wider">Loading...</p>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="min-h-screen">
      <div className="max-w-2xl mx-auto px-4 py-20">
        <h1 className="font-heading text-3xl tracking-widest text-av-bone mb-2">
          MY ACCOUNT
        </h1>
        <p className="text-av-bone-muted text-sm mb-10">
          Welcome back, {session.user.name}
        </p>

        <div className="space-y-4">
          {/* Profile Info */}
          <div className="border border-av-bone-faint p-6">
            <h2 className="font-heading text-sm tracking-widest text-av-bone mb-4">PROFILE</h2>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-av-bone-muted">Name</span>
                <span className="text-av-bone">{session.user.name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-av-bone-muted">Email</span>
                <span className="text-av-bone">{session.user.email}</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <Link href="/account/orders"
            className="block border border-av-bone-faint p-6 hover:border-av-red transition-colors group">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-heading text-sm tracking-widest text-av-bone group-hover:text-av-red transition-colors">
                  ORDER HISTORY
                </h2>
                <p className="text-av-bone-muted text-xs mt-1">View past orders and tracking</p>
              </div>
              <span className="text-av-bone-muted group-hover:text-av-red transition-colors">→</span>
            </div>
          </Link>

          {/* Admin Link (only for admin role) */}
          {session.user.role === 'admin' && (
            <Link href="/admin"
              className="block border border-av-red/30 p-6 hover:border-av-red transition-colors group">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="font-heading text-sm tracking-widest text-av-red">
                    ADMIN DASHBOARD
                  </h2>
                  <p className="text-av-bone-muted text-xs mt-1">Manage products and orders</p>
                </div>
                <span className="text-av-red">→</span>
              </div>
            </Link>
          )}

          {/* Logout */}
          <button
            onClick={() => signOut({ callbackUrl: '/' })}
            className="w-full py-3 border border-av-bone-faint text-av-bone-muted text-xs
                       tracking-widest uppercase hover:border-av-red hover:text-av-red transition-colors"
          >
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
}
