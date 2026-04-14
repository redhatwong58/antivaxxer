/**
 * Legal Page Layout — ANTIVAXXER
 *
 * [AV-024] feat: legal pages
 *
 * Shared layout for Terms, Privacy, Returns, Shipping.
 * Renders title + last updated + sections.
 */

export default function LegalPage({ title, lastUpdated, children }) {
  return (
    <div className="min-h-screen">
      <section className="text-center pt-20 pb-8 px-4">
        <h1 className="font-heading text-4xl md:text-5xl tracking-widest text-av-bone mb-3">
          {title}
        </h1>
        <div className="w-16 h-px bg-av-red mx-auto mb-4" />
        <p className="text-av-bone-muted text-[10px] tracking-widest">
          Last Updated: {lastUpdated}
        </p>
      </section>
      <section className="max-w-3xl mx-auto px-4 sm:px-6 pb-20">
        <div className="prose-legal space-y-6 text-av-bone-muted text-sm font-light leading-relaxed
                        [&_h2]:font-heading [&_h2]:text-lg [&_h2]:tracking-widest [&_h2]:text-av-bone
                        [&_h2]:mt-10 [&_h2]:mb-4
                        [&_strong]:text-av-bone [&_strong]:font-normal
                        [&_a]:text-av-red [&_a]:underline">
          {children}
        </div>
      </section>
    </div>
  );
}
