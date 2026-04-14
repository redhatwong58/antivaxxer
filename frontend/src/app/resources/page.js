/**
 * Resources Page — ANTIVAXXER
 * [AV-037] Rewritten: v5.2.0 — categorized resource links, preserved US map iframe
 *
 * US Map: embedded via iframe from public/us-map.html (D3.js interactive map
 * with 42 states, 47 organizations, 10 themes). Built in earlier sessions.
 */
export const metadata = {
  title: 'Resources',
  description: 'Health freedom resources, state organizations, and advocacy groups.',
};

const categories = [
  { title: 'NATIONAL ORGANIZATIONS', items: [
    { name: 'Stand for Health Freedom', desc: 'Empowering citizens to protect health freedom through legislative action.', url: 'https://standforhealthfreedom.com', tag: 'Advocacy' },
    { name: "Children's Health Defense", desc: 'Ending childhood health epidemics through research, education, and legal advocacy.', url: 'https://childrenshealthdefense.org', tag: 'Research' },
    { name: 'Health Freedom Defense Fund', desc: 'Challenging unconstitutional mandates and defending medical freedom rights.', url: 'https://healthfreedomdefense.org', tag: 'Legal' },
    { name: 'National Vaccine Information Center', desc: 'The oldest and largest consumer-led organization advocating for informed consent.', url: 'https://nvic.org', tag: 'Education' },
  ]},
  { title: 'RESEARCH & SCIENCE', items: [
    { name: 'VAERS Database', desc: 'Official Vaccine Adverse Event Reporting System maintained by CDC and FDA.', url: 'https://vaers.hhs.gov', tag: 'Data' },
    { name: 'The Highwire', desc: 'Weekly investigative health show covering stories major media ignores.', url: 'https://thehighwire.com', tag: 'Media' },
    { name: 'ICAN - Informed Consent Action Network', desc: 'Legal organization obtaining transparency through FOIA and legal action.', url: 'https://icandecide.org', tag: 'Legal' },
  ]},
];

export default function ResourcesPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="pt-24 pb-14 px-10 text-center">
        <h1 className="font-heading text-[clamp(48px,7vw,80px)] tracking-[6px]">RESOURCES</h1>
        <p className="font-light text-sm text-av-bone-muted mt-3">
          Find health freedom organizations in your state. Knowledge is your strongest shield.
        </p>
      </section>

      {/* Categorized Resources */}
      <div className="max-w-[900px] mx-auto px-10 pb-16">
        {categories.map((cat) => (
          <div key={cat.title} className="mb-14">
            <h3 className="font-heading text-xl tracking-[4px] text-av-red mb-6 pb-3 border-b border-av-bone-faint">
              {cat.title}
            </h3>
            {cat.items.map((item) => (
              <a key={item.name} href={item.url} target="_blank" rel="noopener noreferrer"
                className="flex justify-between items-center py-5 border-b border-av-bone-faint
                           cursor-pointer transition-all hover:pl-3 group gap-5">
                <div>
                  <p className="text-[15px] font-normal mb-1 group-hover:text-av-red transition-colors">{item.name}</p>
                  <p className="text-xs text-av-bone-muted font-light">{item.desc}</p>
                  <span className="inline-block mt-1.5 text-[9px] tracking-[2px] uppercase border border-av-bone-dim
                                   px-2 py-0.5 text-av-bone-muted font-light">{item.tag}</span>
                </div>
                <span className="font-heading text-lg text-av-bone-muted flex-shrink-0 group-hover:text-av-red transition-colors">→</span>
              </a>
            ))}
          </div>
        ))}
      </div>

      {/* US Map — preserved from earlier build, embedded via iframe */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="flex items-center gap-4 mb-6 max-w-[900px] mx-auto">
          <span className="font-heading text-sm tracking-[4px] text-av-red">STATE ORGANIZATIONS MAP</span>
          <div className="flex-1 h-px bg-av-bone-faint" />
        </div>
        <div className="border border-av-bone-faint overflow-hidden" style={{ minHeight: '700px' }}>
          <iframe
            src="/us-map.html"
            title="Interactive US Health Freedom Organization Map"
            className="w-full border-0"
            style={{ height: '800px' }}
            loading="lazy"
          />
        </div>
        <p className="text-av-bone-muted text-[10px] tracking-wider text-center mt-4">
          Hover over a state to preview organizations. Click to see full details. 42 states, 47 organizations.
        </p>
      </section>
    </div>
  );
}
