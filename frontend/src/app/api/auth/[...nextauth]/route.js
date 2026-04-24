/**
 * NextAuth.js Route Handler — ANTIVAXXER
 *
 * [AV-016] feat: user accounts with NextAuth.js
 * [AV-049] v5.3.5 — config moved to src/lib/auth.js so server components
 *   (admin layout) can import authOptions and call getServerSession.
 */

import NextAuth from 'next-auth';
import { authOptions } from '@/lib/auth';

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
