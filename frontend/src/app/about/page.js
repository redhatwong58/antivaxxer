/**
 * About Page — ANTIVAXXER
 * [AV-043] Rewritten: v5.3.1 — repositioned around informed/knowledgeable/empowered
 *   Removed "streetwear with a statement" language
 *   Added Option F: dictionary definition editorial as hero moment
 * To rollback: cp _rollback/v5.1.0/app/about/page.js frontend/src/app/about/page.js
 */
export const metadata = {
  title: 'About',
  description: 'A word reclaimed. ANTIVAXXER is about being informed, knowledgeable, and empowered to make your own choices.',
};

const values = [
  { num: '01', title: 'INFORMED', text: 'Read the studies. Read the inserts. Read the dissenting opinions. Knowledge is the foundation of every real choice.' },
  { num: '02', title: 'AUTONOMOUS', text: 'Your body. Your decision. No pressure, no coercion, no shame. Medical freedom is a human right, not a privilege.' },
  { num: '03', title: 'EMPOWERED', text: 'Ask questions. Demand answers. Refuse the trade of comfort for compliance. Empowerment starts with thinking for yourself.' },
  { num: '04', title: 'UNAFRAID', text: 'The word was weaponized. We reclaimed it. Wearing it is a quiet kind of courage — and the start of the conversation.' },
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
          A WORD RECLAIMED
        </h1>
      </section>

      {/* [AV-043] Option F: Dictionary definition editorial — the brand thesis */}
      <section className="max-w-[900px] mx-auto px-10 pb-20">
        <div className="border border-av-bone-faint p-12 md:p-16">
          <p className="font-serif italic text-4xl md:text-5xl text-av-bone mb-2" style={{fontFamily: 'Georgia, serif'}}>
            antivaxxer
          </p>
          <p className="text-av-bone-muted text-sm mb-5">[noun, verb]</p>
          <div className="w-full h-px bg-av-bone-faint mb-6" />
          <p className="text-av-bone text-lg md:text-xl font-light leading-relaxed mb-3">
            A person who thinks and questions.
          </p>
          <p className="text-av-bone text-lg md:text-xl font-light leading-relaxed mb-3">
            A state of mind rooted in autonomy, awareness, and choice.
          </p>
          <p className="text-av-bone-muted text-sm italic mt-6">
            Origin: Reclaimed from a slur. Redefined by those who wear it.
          </p>
        </div>
      </section>

      {/* Mission */}
      <div className="max-w-[800px] mx-auto px-10 pb-24">
        <div className="mb-20">
          <div className="flex items-center gap-4 mb-6">
            <span className="font-heading text-sm tracking-[4px] text-av-red">WHAT WE STAND FOR</span>
            <div className="flex-1 h-px bg-av-bone-faint" />
          </div>
          <h3 className="font-heading text-4xl tracking-[3px] leading-tight mb-5">
            INFORMATION IS<br />THE ANTIDOTE
          </h3>
          <p className="font-light text-[15px] text-av-bone-muted leading-[1.9] mb-4">
            ANTIVAXXER isn&apos;t about being against anything. It&apos;s about being <strong className="text-av-bone font-medium">for
            something</strong> — the right to think critically, ask hard questions, and make decisions based on
            your own research and your own values.
          </p>
          <p className="font-light text-[15px] text-av-bone-muted leading-[1.9]">
            The word was used as a label to silence people. Now it&apos;s a label we wear with pride.
            Because the people who earned that label were usually the ones doing the reading, the
            questioning, and the thinking.
          </p>
        </div>

        {/* Knowledge */}
        <div className="mb-20">
          <div className="flex items-center gap-4 mb-6">
            <span className="font-heading text-sm tracking-[4px] text-av-red">KNOWLEDGE</span>
            <div className="flex-1 h-px bg-av-bone-faint" />
          </div>
          <h3 className="font-heading text-4xl tracking-[3px] leading-tight mb-5">
            READ. QUESTION.<br />DECIDE FOR YOURSELF.
          </h3>
          <p className="font-light text-[15px] text-av-bone-muted leading-[1.9] mb-4">
            We&apos;re not here to tell you what to believe. We&apos;re here to support the people who do
            their own homework. The ones who read the studies instead of the headlines. The ones
            who ask questions even when it&apos;s uncomfortable.
          </p>
          <p className="font-light text-[15px] text-av-bone-muted leading-[1.9]">
            Visit our <a href="/resources" className="text-av-red hover:underline">Resources page</a> for
            health freedom organizations, research databases, and legal advocacy groups. Free thinkers
            across all 50 states, working together.
          </p>
        </div>

        {/* Values grid */}
        <div className="flex items-center gap-4 mb-6">
          <span className="font-heading text-sm tracking-[4px] text-av-red">OUR PRINCIPLES</span>
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
