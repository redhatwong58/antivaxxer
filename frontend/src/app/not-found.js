/**
 * 404 Not Found Page — ANTIVAXXER
 *
 * [WS-16] v5.6.0 — branded 404 page replacing Next.js default.
 * Matches the 403 page styling for brand consistency.
 */

import Link from 'next/link';

export const metadata = {
  title: 'Page Not Found',
  robots: { index: false, follow: false },
};

export default function NotFoundPage() {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="font-heading text-av-red text-xs tracking-[6px] mb-4">404</p>
        <h1 className="font-heading text-3xl tracking-widest text-av-bone mb-4">
          PAGE NOT FOUND
        </h1>
        <p className="text-av-bone-muted text-sm font-light mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-av-red text-av-bone text-xs
                       tracking-widest uppercase hover:bg-av-red-hover transition-colors"
          >
            Home
          </Link>
          <Link
            href="/shop"
            className="inline-block px-6 py-3 border border-av-bone-dim text-av-bone text-xs
                       tracking-widest uppercase hover:border-av-bone transition-colors"
          >
            Shop
          </Link>
        </div>
      </div>
    </div>
  );
}
