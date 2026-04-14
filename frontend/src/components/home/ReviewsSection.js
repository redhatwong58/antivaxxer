/**
 * Customer Reviews Section — star ratings, verified badges
 * [AV-037] new: v5.2.0 UI overhaul
 */
const reviews = [
  { stars: 5, text: "Comfort Colors quality is insane. Wore it three days straight before I realized I should probably wash it. Garment-dyed softness is no joke.", author: 'Mike R.', initials: 'MR', verified: true },
  { stars: 5, text: "Bought the Carhartt hoodie for my husband. He hasn't taken it off. We're starting to worry but also... it looks great.", author: 'Sarah L.', initials: 'SL', verified: true },
  { stars: 5, text: "The PFG shirt at the boat ramp gets comments every single time. Columbia quality with a message. Perfect combo.", author: 'Jake T.', initials: 'JT', verified: true },
  { stars: 5, text: "Vineyard Vines quarter zip at the office. Boss asked about it. Had a great conversation. Sometimes clothes start the right conversations.", author: 'Amanda K.', initials: 'AK', verified: true },
];
export default function ReviewsSection() {
  return (
    <section className="py-20 px-10 max-w-[1400px] mx-auto">
      <div className="flex justify-between items-end mb-12 border-b border-av-bone-faint pb-5">
        <h2 className="font-heading text-[42px] tracking-[4px]">CUSTOMER REVIEWS</h2>
        <span className="text-xs tracking-[3px] uppercase text-av-bone-muted">★ 4.9 Average</span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {reviews.map((r, i) => (
          <div key={i} className="border border-av-bone-faint p-7 hover:border-av-red transition-colors">
            <div className="text-av-gold text-sm tracking-wider mb-3">
              {'★'.repeat(r.stars)}
            </div>
            <p className="text-sm font-light text-av-bone-muted leading-[1.8] italic mb-4">{r.text}</p>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-av-gunmetal flex items-center justify-center
                              font-heading text-sm text-av-red">{r.initials}</div>
              <div>
                <p className="text-xs font-medium">{r.author}</p>
                {r.verified && <p className="text-[10px] text-av-red tracking-wider uppercase font-light">Verified Purchase</p>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
