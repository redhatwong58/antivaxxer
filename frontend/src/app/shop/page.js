/**
 * Shop Page — ANTIVAXXER
 *
 * [AV-006] feat: product modal, cart drawer, cart persistence
 *
 * Full product catalog with category filters and product modal.
 */

'use client';

import { useState, useCallback } from 'react';
import ProductGrid from '@/components/product/ProductGrid';
import ProductModal from '@/components/product/ProductModal';

export default function ShopPage() {
  const [selectedProduct, setSelectedProduct] = useState(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  const handleSelectProduct = useCallback(async (product) => {
    try {
      const res = await fetch(`${API_URL}/products/${product.slug}`);
      const data = await res.json();
      if (data.product) {
        setSelectedProduct(data.product);
      }
    } catch {
      setSelectedProduct(product);
    }
  }, [API_URL]);

  return (
    <div className="min-h-screen">
      <div className="text-center pt-16 pb-8 px-4">
        <h1 className="font-heading text-5xl tracking-widest text-av-bone mb-3">
          SHOP
        </h1>
        <p className="text-av-bone-muted text-xs tracking-wider uppercase">
          Premium streetwear for the health freedom movement
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <ProductGrid onSelectProduct={handleSelectProduct} />
      </div>

      <ProductModal
        product={selectedProduct}
        onClose={() => setSelectedProduct(null)}
      />
    </div>
  );
}
