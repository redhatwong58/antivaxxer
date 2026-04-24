/**
 * 403 Forbidden Page — ANTIVAXXER
 *
 * [AV-049] v5.3.5 — shown when a signed-in non-admin user tries to access
 *   the admin area. The admin layout server component redirects here.
 */

import Link from 'next/link';

export const metadata = {
  title: 'Forbidden',
  robots: { index: false, follow: false },
};

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="font-heading text-av-red text-xs tracking-[6px] mb-4">403</p>
        <h1 className="font-heading text-3xl tracking-widest text-av-bone mb-4">
          ACCESS DENIED
        </h1>
        <p className="text-av-bone-muted text-sm font-light mb-8 leading-relaxed">
          Your account doesn&apos;t have permission to view this area.
          If you think this is a mistake, contact an administrator.
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-av-red text-av-bone text-xs
                     tracking-widest uppercase hover:bg-av-red-hover transition-colors"
        >
          Back to Site
        </Link>
      </div>
    </div>
  );
}
