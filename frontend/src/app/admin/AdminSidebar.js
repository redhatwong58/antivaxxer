/**
 * AdminSidebar — ANTIVAXXER
 *
 * [AV-050] v5.3.6 — sidebar nav for the admin layout. Client component
 *   because it uses usePathname to highlight the active link and signOut
 *   from next-auth/react. The parent layout is a server component with
 *   the auth gate; this component never renders for non-admins.
 *
 *   Visual style matches the v5.3.3 stakeholder mock:
 *   - Black sidebar (#0A0A0A, slightly darker than the main bg)
 *   - "ANTIVAXXER" in Bebas Neue, "ADMIN CONSOLE" red label below
 *   - Nav links uppercase tracked-out, red left-border on active
 *   - Email + sign-out at the bottom
 *
 *   On mobile (<1024px) the sidebar stacks to a horizontal scrollable
 *   top bar.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const NAV = [
  { href: '/admin', label: 'Dashboard', exact: true },
  { href: '/admin/products', label: 'Products' },
  { href: '/admin/inventory', label: 'Inventory' },
  { href: '/admin/orders', label: 'Orders' },
  { href: '/admin/promos', label: 'Promos' },
  { href: '/admin/customers', label: 'Customers' },
  { href: '/admin/failed-webhooks', label: 'DLQ' }, // [AV-057] v5.3.9
];

export default function AdminSidebar({ email }) {
  const pathname = usePathname();

  const isActive = (item) => {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(item.href + '/');
  };

  return (
    <aside className="bg-[#0A0A0A] border-r border-av-bone-faint lg:sticky lg:top-0 lg:h-screen lg:w-[240px] lg:flex lg:flex-col">
      {/* Brand */}
      <div className="px-6 pt-6 pb-5 lg:border-b lg:border-av-bone-faint">
        <h3 className="font-heading text-lg tracking-[3px] text-av-bone leading-none">ANTIVAXXER</h3>
        <span className="text-av-red text-[10px] tracking-[2px] uppercase font-semibold">
          Admin Console
        </span>
      </div>

      {/* Nav — horizontal scroll on mobile, vertical on desktop */}
      <nav className="flex lg:flex-col gap-0 px-2 lg:px-0 lg:py-4 overflow-x-auto lg:overflow-x-visible">
        {NAV.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                flex items-center gap-3 px-6 py-3 text-[13px] tracking-wider uppercase font-light
                whitespace-nowrap transition-all border-l-2
                ${active
                  ? 'text-av-bone border-av-red bg-av-red/10'
                  : 'text-av-bone-muted border-transparent hover:text-av-bone hover:bg-av-red/5'
                }
              `}
            >
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer — email + actions, only visible on desktop */}
      <div className="hidden lg:block lg:mt-auto lg:border-t lg:border-av-bone-faint lg:px-6 lg:py-4">
        {email && (
          <p className="text-av-bone-muted text-[10px] tracking-wider truncate mb-3" title={email}>
            {email}
          </p>
        )}
        <Link
          href="/"
          className="block text-av-bone-muted text-[10px] tracking-widest uppercase hover:text-av-bone transition-colors mb-2"
        >
          ← View Store
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: '/' })}
          className="block text-av-red text-[10px] tracking-widest uppercase hover:text-av-red-hover transition-colors"
        >
          Sign Out →
        </button>
      </div>
    </aside>
  );
}
