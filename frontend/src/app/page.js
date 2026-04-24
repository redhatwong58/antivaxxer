/**
 * Home Page — ANTIVAXXER
 * [AV-037] Rewritten: v5.2.0 UI overhaul — full v9 mock composition
 * To rollback: cp _rollback/v5.1.0/app/page.js frontend/src/app/page.js
 */
'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import ProductGrid from '@/components/product/ProductGrid';
import ProductModal from '@/components/product/ProductModal';
import HeroSection from '@/components/home/HeroSection';
import MarqueeTicker from '@/components/home/MarqueeTicker';
import FeaturedBanner from '@/components/home/FeaturedBanner';
import QuotesSection from '@/components/home/QuotesSection';
import WornByMovementSection from '@/components/home/WornByMovementSection';
import ReviewsSection from '@/components/home/ReviewsSection';
import NewsletterSection from '@/components/home/NewsletterSection';

export default function HomePage() {
  const [selectedProduct, setSelectedProduct] = useState(null);
  const shopRef = useRef(null);
  const scrollToShop = () => shopRef.current?.scrollIntoView({ behavior: 'smooth' });

  return (
    <>
      <HeroSection onShopClick={scrollToShop} />
      <MarqueeTicker />
      <FeaturedBanner />

      {/* Product Grid */}
      <section ref={shopRef} id="shop" className="py-20 px-6 md:px-10 max-w-[1400px] mx-auto">
        <div className="flex justify-between items-end mb-14 border-b border-av-bone-faint pb-5">
          <h2 className="font-heading text-[42px] tracking-[4px]">THE COLLECTION</h2>
          <Link href="/shop" className="text-xs tracking-[3px] uppercase text-av-bone-muted font-light hover:text-av-red transition-colors">
            View All
          </Link>
        </div>
        <ProductGrid onSelectProduct={setSelectedProduct} />
      </section>

      <QuotesSection />
      <WornByMovementSection />
      <ReviewsSection />
      <NewsletterSection />

      {selectedProduct && (
        <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />
      )}
    </>
  );
}
