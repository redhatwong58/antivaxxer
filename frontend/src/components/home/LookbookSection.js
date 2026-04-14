/**
 * Lookbook Section — split image + text callout
 * [AV-037] new: v5.2.0 UI overhaul
 * Image placeholder — replace with real lookbook photography.
 */
export default function LookbookSection() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 min-h-[600px]">
      <div className="min-h-[400px] md:min-h-[600px] bg-av-gunmetal flex items-center justify-center relative overflow-hidden">
        <span className="font-heading text-[120px] tracking-[8px] opacity-[0.06] absolute whitespace-nowrap">
          ANTIVAXXER
        </span>
        <div className="w-20 h-20 border border-av-bone-dim relative flex items-center justify-center">
          <div className="absolute w-px h-10 bg-av-bone-dim" />
          <div className="absolute w-10 h-px bg-av-bone-dim" />
        </div>
      </div>
      <div className="flex flex-col justify-center p-12 md:p-20 border-y border-av-bone-faint">
        <p className="font-light text-xs tracking-[5px] uppercase text-av-red mb-6">Limited Collaboration</p>
        <h2 className="font-heading text-[clamp(36px,5vw,52px)] tracking-[4px] leading-tight mb-6">
          AV x CARHARTT<br />BUILT DIFFERENT
        </h2>
        <p className="font-light text-[15px] text-av-bone-muted leading-[1.8] max-w-[420px] mb-10">
          Premium Carhartt workwear meets ANTIVAXXER conviction. Embroidered logos on
          midweight hoodies, Force tees, and cuffed beanies. Built for work, designed for the movement.
        </p>
        <a href="/shop" className="inline-block self-start px-12 py-4 bg-av-red border border-av-red
                                   text-av-bone font-heading text-base tracking-[4px]
                                   hover:bg-av-red-hover transition-colors">
          SHOP COLLABS
        </a>
      </div>
    </section>
  );
}
