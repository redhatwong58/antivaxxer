/**
 * Resources Page — ANTIVAXXER
 * [AV-037] v5.2.0 — categorized resource links, preserved US map iframe
 * [AV-047] v5.3.4 — page now centers on the US Medical Liberty Map.
 *   Categorized lists removed; the map's sidebar contains National resources
 *   (ICAN featured) and the full state directory.
 * To rollback: cp _rollback/v5.3.3/app/resources/page.js frontend/src/app/resources/page.js
 */
export const metadata = {
  title: 'Resources',
  description: 'United States Medical Liberty Map — state organizations and national resources.',
};

export default function ResourcesPage() {
  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="pt-24 pb-10 px-10 text-center">
        <h1 className="font-heading text-[clamp(48px,7vw,80px)] tracking-[6px]">RESOURCES</h1>
        <p className="font-light text-sm text-av-bone-muted mt-3 max-w-2xl mx-auto">
          Explore medical liberty organizations across the country. Hover any state to preview,
          click for full details. Proceeds support these groups.
        </p>
      </section>

      {/* US Medical Liberty Map — full-width, primary content */}
      <section className="max-w-[1500px] mx-auto px-4 md:px-6 pb-24">
        <div className="border border-av-bone-faint overflow-hidden bg-[#0A0A0A]">
          <iframe
            src="/us-map.html"
            title="United States Medical Liberty Map"
            className="w-full border-0 block"
            style={{ height: 'min(1600px, 180vh)', minHeight: '1200px' }}
            loading="lazy"
          />
        </div>
      </section>
    </div>
  );
}
