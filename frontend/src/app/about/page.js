/**
 * About Page — ANTIVAXXER
 * [AV-037] Rewritten: v5.2.0 — rich layout with value cards, section labels
 */
export const metadata = { title: 'About', description: 'The movement behind the brand.' };

const values = [
  { num: '01', title: 'PREMIUM QUALITY', text: 'Comfort Colors, Carhartt, Columbia, Vineyard Vines. Only the best blanks.' },
  { num: '02', title: 'FREE EXPRESSION', text: 'Wear your convictions. Spark conversations. No apologies.' },
  { num: '03', title: 'COMMUNITY', text: 'Part of a growing movement of free thinkers across all 50 states.' },
  { num: '04', title: 'TRANSPARENCY', text: 'No hidden agendas. No corporate sponsors. Just truth in cotton.' },
];

export default function AboutPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="min-h-[45vh] flex items-center justify-center text-center px-10 pt-24 pb-20 relative">
        <span className="absolute font-heading text-[clamp(100px,15vw,220px)] tracking-[12px] opacity-[0.03] whitespace-nowrap">
          ANTIVAXXER
        </span>
        <h1 className="font-heading text-[clamp(48px,7vw,96px)] tracking-[8px] relative">
          THE MOVEMENT
        </h1>
      </section>

      <div className="max-w-[800px] mx-auto px-10 pb-24">
        {/* Mission */}
        <div className="mb-20">
          <div className="flex items-center gap-4 mb-6">
            <span className="font-heading text-sm tracking-[4px] text-av-red">OUR MISSION</span>
            <div className="flex-1 h-px bg-av-bone-faint" />
          </div>
          <h3 className="font-heading text-4xl tracking-[3px] leading-tight mb-5">
            STREETWEAR WITH<br />A STATEMENT
          </h3>
          <p className="font-light text-[15px] text-av-bone-muted leading-[1.9] mb-4">
            ANTIVAXXER is premium streetwear for the health freedom movement. We don&apos;t do cheap
            blanks or screen-printed slogans. Every piece is built on <strong className="text-av-bone font-medium">trusted
            brand foundations</strong> — Comfort Colors garment-dyed cotton, Carhartt workwear, Columbia PFG
            performance fabrics, and Vineyard Vines lifestyle pieces.
          </p>
          <p className="font-light text-[15px] text-av-bone-muted leading-[1.9]">
            We partner with brands people already trust, then add designs that spark
            conversation. Not political. Not partisan. Just freedom.
          </p>
        </div>

        {/* Quality */}
        <div className="mb-20">
          <div className="flex items-center gap-4 mb-6">
            <span className="font-heading text-sm tracking-[4px] text-av-red">QUALITY</span>
            <div className="flex-1 h-px bg-av-bone-faint" />
          </div>
          <h3 className="font-heading text-4xl tracking-[3px] leading-tight mb-5">
            BUILT TO LAST
          </h3>
          <p className="font-light text-[15px] text-av-bone-muted leading-[1.9]">
            6.1 oz heavyweight ring-spun cotton. Garment-dyed for that lived-in softness from day one.
            OEKO-TEX Standard 100 certified. Embroidered logos that don&apos;t crack, peel, or fade. Every
            product is designed to be the shirt you reach for first.
          </p>
        </div>

        {/* Values grid */}
        <div className="flex items-center gap-4 mb-6">
          <span className="font-heading text-sm tracking-[4px] text-av-red">OUR VALUES</span>
          <div className="flex-1 h-px bg-av-bone-faint" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {values.map((v) => (
            <div key={v.num} className="border border-av-bone-faint p-8 hover:border-av-red transition-colors">
              <div className="font-heading text-5xl text-av-red mb-2">{v.num}</div>
              <h4 className="font-heading text-lg tracking-[3px] mb-3">{v.title}</h4>
              <p className="text-sm text-av-bone-muted font-light leading-[1.7]">{v.text}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
