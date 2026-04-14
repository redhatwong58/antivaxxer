/**
 * Featured Banner — large typography statement
 * [AV-037] new: v5.2.0 UI overhaul
 */
export default function FeaturedBanner() {
  return (
    <section className="py-24 px-10 text-center border-b border-av-bone-faint">
      <p className="font-light text-xs tracking-[5px] uppercase text-av-bone-muted mb-4">
        Streetwear with a Purpose
      </p>
      <h2 className="font-heading text-[clamp(42px,6vw,72px)] tracking-[6px] leading-tight">
        THE BRAND THAT<br /><span className="text-av-red">FIGHTS BACK</span>
      </h2>
    </section>
  );
}
