/**
 * Session Provider — ANTIVAXXER
 *
 * [AV-016] feat: user accounts with NextAuth.js
 *
 * Wraps the app in NextAuth's SessionProvider so any
 * client component can access the session via useSession().
 */

'use client';

import { SessionProvider } from 'next-auth/react';

export default function AuthProvider({ children }) {
  return <SessionProvider>{children}</SessionProvider>;
}
