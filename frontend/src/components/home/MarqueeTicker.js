/**
 * Marquee Ticker — horizontal scrolling brand values
 * [AV-037] new: v5.2.0 UI overhaul
 */
const items = [
  'FREE THINKER APPROVED', 'PREMIUM QUALITY', 'MADE IN THE USA',
  'QUESTION EVERYTHING', 'COMFORT COLORS', 'CARHARTT COLLABS',
  'COLUMBIA PFG', 'VINEYARD VINES',
];
export default function MarqueeTicker() {
  const track = [...items, ...items];
  return (
    <div className="overflow-hidden py-5 border-y border-av-bone-faint">
      <div className="flex w-max animate-marquee">
        {track.map((t, i) => (
          <span key={i} className="font-heading text-[13px] tracking-[6px] whitespace-nowrap px-10 text-av-bone-muted">
            {t} <span className="inline-block w-1 h-1 bg-av-red rounded-full align-middle mx-5" />
          </span>
        ))}
      </div>
    </div>
  );
}
