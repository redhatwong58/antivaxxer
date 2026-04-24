/**
 * Error Boundary — ANTIVAXXER
 *
 * [WS-16] v5.6.0 — branded error page replacing Next.js default.
 * Next.js App Router requires error.js to be a client component.
 *
 * Catches unhandled errors in child routes. Does NOT catch errors in:
 *   - layout.js (use global-error.js for that)
 *   - Server components during SSR (shows the nearest error boundary)
 *
 * The `reset` prop lets the user retry without a full page reload.
 */

'use client';

export default function ErrorPage({ error, reset }) {
  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="text-center max-w-md">
        <p className="font-heading text-av-red text-xs tracking-[6px] mb-4">ERROR</p>
        <h1 className="font-heading text-3xl tracking-widest text-av-bone mb-4">
          SOMETHING WENT WRONG
        </h1>
        <p className="text-av-bone-muted text-sm font-light mb-8 leading-relaxed">
          We hit an unexpected error. This has been logged and we&apos;ll look into it.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => reset()}
            className="px-6 py-3 bg-av-red text-av-bone text-xs
                       tracking-widest uppercase hover:bg-av-red-hover transition-colors"
          >
            Try Again
          </button>
          <a
            href="/"
            className="px-6 py-3 border border-av-bone-dim text-av-bone text-xs
                       tracking-widest uppercase hover:border-av-bone transition-colors"
          >
            Home
          </a>
        </div>
      </div>
    </div>
  );
}
