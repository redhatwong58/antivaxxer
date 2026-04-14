/**
 * Hero Section — full-viewport with animated logo, tagline, CTA
 * [AV-037] new: v5.2.0 UI overhaul
 *
 * Logo: uses /images/logo.svg if available, falls back to text.
 * Replace logo by swapping the file in public/images/logo.svg.
 * To remove: delete this file, remove from home page.
 */
'use client';
export default function HeroSection({ onShopClick }) {
  return (
    <section className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse at 30% 50%, rgba(106,14,14,0.15) 0%, transparent 60%), radial-gradient(ellipse at 70% 80%, rgba(106,14,14,0.08) 0%, transparent 50%)',
        }} />
      {/* Content */}
      <div className="relative z-10 text-center px-10">
        <div className="animate-hero">
          {/* Logo — swap public/images/logo.svg to replace */}
          <img src="/images/logo.svg" alt="ANTIVAXXER"
               className="mx-auto max-w-[400px] w-full"
               onError={(e) => {
                 e.target.style.display = 'none';
                 e.target.nextSibling.style.display = 'block';
               }} />
          <h1 className="font-heading text-[clamp(48px,8vw,96px)] tracking-[8px] text-av-bone leading-none"
              style={{ display: 'none' }}>
            ANTIVA<span className="text-av-red">X</span>XER
          </h1>
        </div>
        <p className="animate-fade-1 font-light text-[clamp(12px,1.5vw,15px)] tracking-[6px]
                      uppercase text-av-bone-muted mt-3">
          Question Everything. Wear Your Conviction.
        </p>
        <div className="animate-fade-2 mt-5">
          <button onClick={onShopClick}
            className="btn-fill px-14 py-4 border border-av-bone text-av-bone font-heading
                       text-base tracking-[4px] cursor-pointer bg-transparent transition-all">
            SHOP THE COLLECTION
          </button>
        </div>
      </div>
      {/* Scroll indicator */}
      <div className="animate-fade-3 absolute bottom-10 left-1/2 -translate-x-1/2">
        <div className="w-px h-[60px] mx-auto relative overflow-hidden"
             style={{ background: 'linear-gradient(to bottom, rgba(232,229,221,0.5), transparent)' }}>
          <div className="absolute left-0 w-px h-[60px] bg-av-red"
               style={{ animation: 'scrollPulse 2s ease infinite' }} />
        </div>
      </div>
    </section>
  );
}
