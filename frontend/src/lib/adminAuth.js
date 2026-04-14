/**
 * useAdminAuth — Admin Authentication Hook
 *
 * [AV-016] feat: user accounts with NextAuth.js
 *
 * Returns auth headers for admin API calls and redirects
 * non-admin users. Works with both NextAuth sessions (Phase 3)
 * and legacy ADMIN_TOKEN (backward compatible).
 */

'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

export function useAdminAuth() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (status === 'loading') return;

    // Check NextAuth session first
    if (session?.user?.role === 'admin') {
      setReady(true);
      return;
    }

    // Fallback: check legacy sessionStorage token
    const legacyToken = sessionStorage.getItem('av_admin_token');
    if (legacyToken) {
      setReady(true);
      return;
    }

    // No admin access — redirect to login
    if (status === 'unauthenticated') {
      router.push('/account/login');
    } else if (session && session.user?.role !== 'admin') {
      router.push('/account');
    }
  }, [session, status, router]);

  // Build auth headers for API calls — uses signed JWT, not x-user-id
  const getHeaders = () => {
    const headers = {};

    if (session?.user?.apiToken) {
      headers['Authorization'] = `Bearer ${session.user.apiToken}`;
    } else {
      // Legacy fallback: ADMIN_TOKEN from sessionStorage
      const legacyToken = sessionStorage.getItem('av_admin_token');
      if (legacyToken) {
        headers['Authorization'] = `Bearer ${legacyToken}`;
      }
    }

    return headers;
  };

  return { ready, session, getHeaders };
}
