/**
 * Footer — ANTIVAXXER
 * [AV-037] Rewritten: v5.2.0 UI overhaul — 4-column grid, social icons
 * To rollback: cp _rollback/v5.1.0/components/layout/Footer.js frontend/src/components/layout/Footer.js
 */
import Link from 'next/link';
const currentYear = new Date().getFullYear();
export default function Footer() {
  return (
    <footer className="border-t border-av-bone-faint pt-20 pb-10 px-6 md:px-10">
      <div className="max-w-[1400px] mx-auto grid grid-cols-1 md:grid-cols-4 gap-12 md:gap-16 mb-16">
        {/* Brand */}
        <div>
          <div className="font-heading text-[28px] tracking-[4px] mb-4">
            ANTIVA<span className="text-av-red">X</span>XER
          </div>
          <p className="font-light text-sm text-av-bone-muted leading-[1.8] max-w-[300px]">
            Premium streetwear for the health freedom movement. Quality blanks. Bold statements.
            Question everything.
          </p>
        </div>
        {/* Shop */}
        <div>
          <h4 className="font-heading text-base tracking-[3px] mb-5">SHOP</h4>
          {['Tees', 'Long Sleeve', 'Hoodies', 'Hats', 'Collabs'].map((l) => (
            <Link key={l} href="/shop" className="block text-av-bone-muted text-sm font-light mb-3 hover:text-av-red transition-colors">
              {l}
            </Link>
          ))}
        </div>
        {/* Info */}
        <div>
          <h4 className="font-heading text-base tracking-[3px] mb-5">INFO</h4>
          {[
            { l: 'About', h: '/about' }, { l: 'FAQ', h: '/faq' },
            { l: 'Resources', h: '/resources' }, { l: 'Contact', h: 'mailto:support@antivaxxer.com' },
          ].map((x) => (
            <Link key={x.l} href={x.h} className="block text-av-bone-muted text-sm font-light mb-3 hover:text-av-red transition-colors">
              {x.l}
            </Link>
          ))}
        </div>
        {/* Legal */}
        <div>
          <h4 className="font-heading text-base tracking-[3px] mb-5">LEGAL</h4>
          {[
            { l: 'Terms of Service', h: '/terms' }, { l: 'Privacy Policy', h: '/privacy' },
            { l: 'Return Policy', h: '/returns' }, { l: 'Shipping Policy', h: '/shipping-policy' },
          ].map((x) => (
            <Link key={x.l} href={x.h} className="block text-av-bone-muted text-sm font-light mb-3 hover:text-av-red transition-colors">
              {x.l}
            </Link>
          ))}
        </div>
      </div>
      {/* Bottom bar */}
      <div className="max-w-[1400px] mx-auto pt-8 border-t border-av-bone-faint flex flex-col sm:flex-row justify-between items-center gap-4">
        <p className="text-av-bone-muted text-[11px] tracking-wider font-light">
          &copy; {currentYear} ANTIVAXXER. All rights reserved.
        </p>
        <div className="flex gap-4">
          {[
            { label: 'Instagram', path: 'M7.8 2h8.4C19 2 22 5 22 7.8v8.4a5.8 5.8 0 01-5.8 5.8H7.8C5 22 2 19 2 16.2V7.8A5.8 5.8 0 017.8 2m-.2 2A3.6 3.6 0 004 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 003.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5M12 7a5 5 0 110 10 5 5 0 010-10m0 2a3 3 0 100 6 3 3 0 000-6z' },
            { label: 'X', path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z' },
            { label: 'TikTok', path: 'M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z' },
          ].map((s) => (
            <a key={s.label} href="#" aria-label={s.label}
               className="w-8 h-8 flex items-center justify-center text-av-bone-muted hover:text-av-red transition-colors">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d={s.path}/></svg>
            </a>
          ))}
        </div>
      </div>
    </footer>
  );
}
