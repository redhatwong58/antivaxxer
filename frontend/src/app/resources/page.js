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

import InlineUsMap from '@/components/resources/InlineUsMap';

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

      {/* US Map — migrated inline from public/us-map.html (no iframe) */}
      <section className="max-w-7xl mx-auto px-6 pb-24">
        <div className="flex items-center gap-4 mb-6 max-w-[900px] mx-auto">
          <span className="font-heading text-sm tracking-[4px] text-av-red">STATE ORGANIZATIONS MAP</span>
          <div className="flex-1 h-px bg-av-bone-faint" />
        </div>
        <InlineUsMap />
        <p className="text-av-bone-muted text-[10px] tracking-wider text-center mt-4">
          Hover over a state to preview organizations. Click to see full details. 42 states, 47 organizations.
        </p>
      </section>
    </div>
  );
}
