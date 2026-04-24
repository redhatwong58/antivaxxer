/**
 * Worn By Movement Section — ANTIVAXXER
 * [AV-044] new: v5.3.1 — replaces LookbookSection.js (removed Carhartt collab reference)
 *
 * Merged concepts: featured product + customer testimonial + community callout.
 * Definition Tee is the anchor product. Dual CTAs: commerce (shop) + community (resources).
 *
 * TODO: Replace "Free thinkers across all 50 states" with real metrics when available
 *       (e.g., "Join X,XXX thinkers" — leave the placeholder until real numbers exist).
 *
 * To rollback: cp _rollback/v5.2.0/components/home/LookbookSection.js frontend/src/components/home/
 *              Then revert page.js import back to LookbookSection.
 */
import Link from 'next/link';

export default function WornByMovementSection() {
  return (
    <section className="grid grid-cols-1 md:grid-cols-2 min-h-[600px]">
      {/* Left: featured product image + testimonial overlay */}
      <div className="relative min-h-[400px] md:min-h-[600px] bg-av-gunmetal flex items-center justify-center overflow-hidden">
        {/* Watermark background */}
        <span className="absolute font-heading text-[140px] tracking-[8px] opacity-[0.04] whitespace-nowrap select-none">
          antivaxxer
        </span>

        {/* [AV-048] v5.3.3 — real Definition Tee product image */}
        <div className="relative z-10 w-full max-w-[360px] aspect-square overflow-hidden">
          <img
            src="/images/products/definition-tee-noun-black.jpg"
            alt="Definition Tee — Front and Back"
            className="w-full h-full object-cover"
          />
        </div>

        {/* Testimonial pull-quote overlay — bottom left */}
        <div className="absolute bottom-8 left-8 right-8 md:left-12 md:right-12 z-20">
          <p className="font-serif italic text-av-bone text-sm md:text-base leading-relaxed mb-2"
             style={{fontFamily: 'Georgia, serif'}}>
            &ldquo;People ask me what it means. That&apos;s the whole point.&rdquo;
          </p>
          <p className="text-av-bone-muted text-[10px] tracking-[2px] uppercase">
            — Verified Customer
          </p>
        </div>
      </div>

      {/* Right: editorial copy + dual CTAs */}
      <div className="flex flex-col justify-center p-12 md:p-20 border-y border-av-bone-faint">
        <p className="font-light text-xs tracking-[5px] uppercase text-av-red mb-6">
          Worn by the Movement
        </p>
        <h2 className="font-heading text-[clamp(36px,5vw,52px)] tracking-[4px] leading-tight mb-6">
          THE DEFINITION<br />SPEAKS FOR ITSELF
        </h2>
        <p className="font-light text-[15px] text-av-bone-muted leading-[1.8] max-w-[460px] mb-4">
          The Definition Tee is more than apparel — it&apos;s a conversation starter, a quiet
          declaration, and the most honest way we know to explain what this brand is about.
        </p>
        <p className="font-light text-[15px] text-av-bone-muted leading-[1.8] max-w-[460px] mb-10">
          Free thinkers across all 50 states are wearing it. Join them.
        </p>

        {/* Dual CTAs */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Link href="/shop/definition-tee"
            className="inline-block px-10 py-4 bg-av-red border border-av-red text-av-bone
                       font-heading text-sm tracking-[4px] text-center hover:bg-av-red-hover
                       transition-colors">
            SHOP THE DEFINITION TEE
          </Link>
          <Link href="/resources"
            className="inline-block px-10 py-4 bg-transparent border border-av-bone-dim text-av-bone
                       font-heading text-sm tracking-[4px] text-center hover:border-av-bone
                       transition-colors">
            EXPLORE RESOURCES
          </Link>
        </div>
      </div>
    </section>
  );
}
