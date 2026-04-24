/**
 * Admin Layout — ANTIVAXXER
 *
 * [AV-008] feat: admin product list with temp auth gate
 * [AV-049] v5.3.5 — converted to server component with HARD auth gate
 * [AV-050] v5.3.6 — visual rewrite to match the v5.3.3 stakeholder mock:
 *   240px left sidebar, ANTIVAXXER + ADMIN CONSOLE branding, Bebas Neue
 *   nav links with red left-border active state, signed-in admin email
 *   in the sidebar footer, "Sign Out" + "View Store" links at the bottom.
 *   Mobile (<1024px): sidebar stacks horizontally as a top bar.
 *
 *   The HARD AUTH GATE is preserved unchanged from v5.3.5 — every request
 *   checks the NextAuth session server-side, redirects unauthenticated
 *   users to /account/login?callbackUrl=/admin, and redirects signed-in
 *   non-admins to /403.
 *
 * To rollback: cp _rollback/v5.3.5/app/admin/layout.js frontend/src/app/admin/layout.js
 */

import { getServerSession } from 'next-auth';
import { redirect } from 'next/navigation';
import { authOptions } from '@/lib/auth';
import AdminSidebar from './AdminSidebar';

export const metadata = {
  title: {
    default: 'Admin',
    template: '%s — ANTIVAXXER Admin',
  },
  robots: { index: false, follow: false },
};

// Force dynamic rendering — server-side session check must run on every request
export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }) {
  // === HARD AUTH GATE — runs on every /admin/* request ===
  const session = await getServerSession(authOptions);

  if (!session) {
    redirect('/account/login?callbackUrl=/admin');
  }

  if (session.user?.role !== 'admin') {
    redirect('/403');
  }
  // === END AUTH GATE ===

  return (
    <div className="min-h-screen bg-av-black text-av-bone">
      <div className="lg:grid lg:grid-cols-[240px_1fr] min-h-screen">
        <AdminSidebar email={session.user?.email || ''} />
        <main className="px-6 py-8 lg:px-10 lg:py-10 overflow-x-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
