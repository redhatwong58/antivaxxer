/**
 * FAQ Page — ANTIVAXXER
 * [AV-037] Rewritten: v5.2.0 — accordion with categories, size chart
 * To rollback: cp _rollback/v5.1.0/app/faq/page.js frontend/src/app/faq/page.js
 */
'use client';
import { useState } from 'react';

const faqData = [
  { cat: 'ORDERS & SHIPPING', items: [
    { q: 'How long does shipping take?', a: 'Standard shipping is 5-7 business days within the US. Orders over $75 ship free. You\'ll receive tracking via email once shipped.' },
    { q: 'Do you ship internationally?', a: 'Not currently. We plan to add international shipping in a future update.' },
    { q: 'Can I change or cancel my order?', a: 'Contact us within 1 hour of placing your order at support@antivaxxer.com. Once shipped, orders cannot be modified.' },
  ]},
  { cat: 'PRODUCTS & SIZING', items: [
    { q: 'What blanks do you use?', a: 'Comfort Colors 1717 (tees), 6014 (long sleeve), 1566 (crewneck), 1567 (hoodie). Collabs use the respective brand blanks: Carhartt, Columbia PFG, Vineyard Vines.' },
    { q: 'How do your shirts fit?', a: 'Comfort Colors run true to size with a relaxed fit. If you prefer a slimmer fit, size down. Carhartt runs slightly large. Columbia and Vineyard Vines are true to size.' },
    { q: 'Are your products garment-dyed?', a: 'All Comfort Colors products are garment-dyed for a soft, vintage feel from day one. They may shrink slightly on first wash — this is normal for garment-dyed cotton.' },
  ]},
  { cat: 'RETURNS & EXCHANGES', items: [
    { q: 'What is your return policy?', a: 'Returns accepted within 30 days. Items must be unworn, unwashed, with tags attached. Sale items are final sale.' },
    { q: 'How do I start a return?', a: 'Email support@antivaxxer.com with your order number. We\'ll provide return instructions and a shipping address.' },
    { q: 'Do you offer exchanges?', a: 'Yes — same product, different size, subject to availability. Contact us to arrange.' },
  ]},
];

function FaqItem({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-av-bone-faint">
      <button onClick={() => setOpen(!open)}
        className="w-full flex justify-between items-center py-5 cursor-pointer text-left
                   bg-transparent border-none text-av-bone hover:text-av-red transition-colors gap-5">
        <h4 className="font-normal text-[15px]">{q}</h4>
        <span className={`font-heading text-2xl text-av-bone-muted flex-shrink-0 transition-transform duration-300
                         ${open ? 'rotate-45 text-av-red' : ''}`}>+</span>
      </button>
      <div className={`overflow-hidden transition-all duration-400 ${open ? 'max-h-[500px]' : 'max-h-0'}`}>
        <p className="pb-5 font-light text-sm text-av-bone-muted leading-[1.8]">{a}</p>
      </div>
    </div>
  );
}

export default function FaqPage() {
  return (
    <div className="min-h-screen">
      <section className="pt-24 pb-14 px-10 text-center">
        <h1 className="font-heading text-[clamp(48px,7vw,80px)] tracking-[6px]">FAQ</h1>
        <p className="font-light text-sm text-av-bone-muted mt-3">Everything you need to know.</p>
      </section>
      <div className="max-w-[800px] mx-auto px-10 pb-24">
        {faqData.map((section) => (
          <div key={section.cat} className="mb-12">
            <h3 className="font-heading text-xl tracking-[4px] text-av-red mb-6 pb-3 border-b border-av-bone-faint">
              {section.cat}
            </h3>
            {section.items.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
