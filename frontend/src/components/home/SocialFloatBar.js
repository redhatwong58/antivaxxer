/**
 * Social Floating Sidebar — fixed left edge
 * [AV-037] new: v5.2.0 UI overhaul
 * To remove: delete this file, remove from layout.js
 */
'use client';
const socials = [
  { label: 'Instagram', path: 'M7.8 2h8.4C19 2 22 5 22 7.8v8.4a5.8 5.8 0 01-5.8 5.8H7.8C5 22 2 19 2 16.2V7.8A5.8 5.8 0 017.8 2m-.2 2A3.6 3.6 0 004 7.6v8.8C4 18.39 5.61 20 7.6 20h8.8a3.6 3.6 0 003.6-3.6V7.6C20 5.61 18.39 4 16.4 4H7.6m9.65 1.5a1.25 1.25 0 110 2.5 1.25 1.25 0 010-2.5M12 7a5 5 0 110 10 5 5 0 010-10m0 2a3 3 0 100 6 3 3 0 000-6z', href: '#' },
  { label: 'X', path: 'M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z', href: '#' },
  { label: 'TikTok', path: 'M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z', href: '#' },
  { label: 'Facebook', path: 'M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z', href: '#' },
];
export default function SocialFloatBar() {
  return (
    <div className="fixed left-0 top-1/2 -translate-y-1/2 z-[80] hidden lg:flex flex-col">
      {socials.map((s) => (
        <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" aria-label={s.label}
           className="flex items-center justify-center w-11 h-11 bg-av-gunmetal
                      border-b border-av-black text-av-bone hover:bg-av-red transition-colors">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d={s.path}/></svg>
        </a>
      ))}
    </div>
  );
}
