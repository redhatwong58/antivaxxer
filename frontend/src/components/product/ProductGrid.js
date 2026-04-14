/**
 * ProductGrid Component — ANTIVAXXER
 *
 * [AV-005] feat: product grid with API integration
 *
 * Fetches products from the Express API and renders a filterable grid.
 * Handles three states per Error Handling Standards:
 * - Loading: skeleton shimmer grid
 * - Error: friendly message with retry
 * - Empty: "No products found" with reset filter
 *
 * Category filtering is done client-side via API query param.
 * Product selection triggers onSelectProduct (wired to modal in Step 5c).
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import ProductCard from './ProductCard';
import CategoryFilter from './CategoryFilter';
import { ProductGridSkeleton } from '@/components/ui/Skeleton';

export default function ProductGrid({ onSelectProduct }) {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  // Fetch categories on mount
  useEffect(() => {
    fetch(`${API_URL}/categories`)
      .then((res) => res.json())
      .then((data) => {
        if (data.categories) setCategories(data.categories);
      })
      .catch(() => {
        // Categories failing is non-critical — grid still works without filters
      });
  }, [API_URL]);

  // Fetch products (on mount and when category changes)
  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      if (activeCategory) params.set('category', activeCategory);
      params.set('sort', 'sort_order');

      const res = await fetch(`${API_URL}/products?${params}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.error?.message || 'Failed to load products');
      }

      setProducts(data.products || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [API_URL, activeCategory]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // Handle filter change
  const handleFilter = (categorySlug) => {
    setActiveCategory(categorySlug);
  };

  return (
    <section>
      {/* Category Filter Tabs */}
      {categories.length > 0 && (
        <CategoryFilter
          categories={categories}
          activeCategory={activeCategory}
          onFilter={handleFilter}
        />
      )}

      {/* Loading State */}
      {loading && <ProductGridSkeleton count={8} />}

      {/* Error State */}
      {error && !loading && (
        <div className="text-center py-16">
          <p className="text-av-bone-muted text-sm mb-4">{error}</p>
          <button
            onClick={fetchProducts}
            className="px-6 py-2 border border-av-red text-av-red text-xs
                       tracking-widest uppercase hover:bg-av-red hover:text-white
                       transition-colors duration-200"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && products.length === 0 && (
        <div className="text-center py-16">
          <p className="text-av-bone-muted text-sm mb-4">
            No products found{activeCategory ? ` in this category` : ''}.
          </p>
          {activeCategory && (
            <button
              onClick={() => handleFilter(null)}
              className="px-6 py-2 border border-av-bone-dim text-av-bone-muted text-xs
                         tracking-widest uppercase hover:border-av-bone hover:text-av-bone
                         transition-colors duration-200"
            >
              View All Products
            </button>
          )}
        </div>
      )}

      {/* Product Grid */}
      {!loading && !error && products.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onQuickView={onSelectProduct || null}
            />
          ))}
        </div>
      )}
    </section>
  );
}
