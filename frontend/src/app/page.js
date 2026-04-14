/**
 * Home Page — ANTIVAXXER
 * [AV-037] Rewritten: v5.2.0 UI overhaul — full v9 mock composition
 */
'use client';
import { useRef } from 'react';
import Link from 'next/link';
import HeroSection from '@/components/home/HeroSection';
import MarqueeTicker from '@/components/home/MarqueeTicker';
import FeaturedBanner from '@/components/home/FeaturedBanner';
import QuotesSection from '@/components/home/QuotesSection';
import LookbookSection from '@/components/home/LookbookSection';
import ReviewsSection from '@/components/home/ReviewsSection';
import NewsletterSection from '@/components/home/NewsletterSection';

const mockFeaturedProducts = [
  {
    name: 'ICON LOGO HOODIE',
    meta: 'MIDWEIGHT FLEECE / EMBROIDERED',
    href: '/shop',
    image: '/images/products/mock-v8-hoodie.jpg',
  },
  {
    name: 'FORCE TEE',
    meta: 'HEAVY COTTON / SCREEN PRINT',
    href: '/shop',
    image: '/images/products/mock-v8-force-tee.jpg',
  },
  {
    name: 'CLASSIC BEANIE',
    meta: 'CUFFED KNIT / EMBROIDERED MARK',
    href: '/shop',
    image: '/images/products/mock-v8-beanie.jpg',
  },
  {
    name: 'WORK JACKET',
    meta: 'DUCK CANVAS / LIMITED DROP',
    href: '/shop',
    image: '/images/products/mock-v8-work-jacket.jpg',
  },
];

export default function HomePage() {
  const shopRef = useRef(null);
  const scrollToShop = () => shopRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <>
      <HeroSection onShopClick={scrollToShop} />
      <MarqueeTicker />
      <FeaturedBanner />

      {/* Temporary fallback section from mock while API product grid is unstable */}
      <section
        ref={shopRef}
        id="products-section"
        className="py-20 px-6 md:px-10 max-w-[1400px] mx-auto"
      >
        <div className="flex justify-between items-end mb-14 border-b border-av-bone-faint pb-5">
          <h2 className="font-heading text-[42px] tracking-[4px]">THE COLLECTION</h2>
          <Link href="/shop" className="text-xs tracking-[3px] uppercase text-av-bone-muted font-light hover:text-av-red transition-colors">
            View All
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {mockFeaturedProducts.map((item) => (
            <Link
              key={item.name}
              href={item.href}
              className="group border border-av-bone-faint p-6 min-h-[220px] flex flex-col justify-between
                         hover:border-av-red transition-colors"
            >
              <div className="relative w-full aspect-square bg-av-gunmetal/40 border border-av-bone-faint overflow-hidden">
                <img
                  src={item.image}
                  alt={item.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                    if (e.currentTarget.nextElementSibling) {
                      e.currentTarget.nextElementSibling.style.display = 'flex';
                    }
                  }}
                />
                <div
                  className="absolute inset-0 hidden items-center justify-center text-[10px]
                             tracking-[3px] text-av-bone-dim"
                >
                  PRODUCT IMAGE
                </div>
              </div>
              <div className="mt-5">
                <h3 className="font-heading text-[18px] tracking-[2px] group-hover:text-av-red transition-colors">
                  {item.name}
                </h3>
                <p className="text-[10px] tracking-[2px] text-av-bone-muted mt-2">{item.meta}</p>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <QuotesSection />
      <LookbookSection />
      <ReviewsSection />
      <NewsletterSection />
    </>
  );
}
