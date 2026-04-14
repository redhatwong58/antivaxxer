/**
 * Admin Layout — ANTIVAXXER
 *
 * [AV-008] feat: admin product list with temp auth gate
 *
 * Separate layout for admin pages. No public header/footer —
 * clean admin interface with navigation back to the main site.
 */

export const metadata = {
  title: {
    default: 'Admin',
    template: '%s — ANTIVAXXER Admin',
  },
  robots: {
    index: false,
    follow: false,
  },
};

export default function AdminLayout({ children }) {
  return (
    <div className="min-h-screen bg-av-black">
      {/* Admin Header */}
      <header className="border-b border-av-bone-faint">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-4">
              <span className="font-heading text-lg tracking-widest text-av-bone">
                ANTIVAXXER
              </span>
              <span className="text-av-red text-[10px] tracking-widest uppercase font-bold px-2 py-0.5 border border-av-red">
                Admin
              </span>
            </div>
            <nav className="flex items-center gap-6">
              <a
                href="/admin"
                className="text-av-bone-muted text-xs tracking-wider hover:text-av-bone transition-colors"
              >
                Products
              </a>
              <a
                href="/admin/orders"
                className="text-av-bone-muted text-xs tracking-wider hover:text-av-bone transition-colors"
              >
                Orders
              </a>
              <a
                href="/"
                className="text-av-bone-muted text-xs tracking-wider hover:text-av-bone transition-colors"
              >
                ← Back to Site
              </a>
            </nav>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
