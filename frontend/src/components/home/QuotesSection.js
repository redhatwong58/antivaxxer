/**
 * Witty Quotes Section — customer quote cards
 * [AV-037] new: v5.2.0 UI overhaul
 */
const quotes = [
  { text: "I wore this to Whole Foods and three people asked where to get one. Mission accomplished.", product: 'Classic Logo Tee' },
  { text: "My doctor saw it and laughed. Then asked for the link. We're winning.", product: 'Carhartt Hoodie' },
  { text: "The Vineyard Vines collab at the country club was... educational for everyone.", product: 'VV Quarter Zip' },
  { text: "TSA agent complimented my hat. Said 'nice logo.' I said 'nice rights.' We nodded.", product: 'Trucker Hat' },
];
export default function QuotesSection() {
  return (
    <section className="py-20 px-10 border-y border-av-bone-faint">
      <div className="max-w-[1400px] mx-auto">
        <div className="flex justify-between items-end mb-12 border-b border-av-bone-faint pb-5">
          <h2 className="font-heading text-[42px] tracking-[4px]">OVERHEARD</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {quotes.map((q, i) => (
            <div key={i} className="border border-av-bone-faint p-8 hover:border-av-red transition-colors">
              <div className="font-heading text-5xl text-av-red opacity-60 leading-none mb-3">&ldquo;</div>
              <p className="text-sm font-light text-av-bone-muted leading-[1.8] italic">{q.text}</p>
              <p className="mt-4 font-heading text-xs tracking-[3px] text-av-red">{q.product}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
