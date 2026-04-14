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

const fallbackProducts = [
  {
    name: 'ICON LOGO HOODIE',
    meta: 'MIDWEIGHT FLEECE / EMBROIDERED',
    href: '/shop',
    image: '/images/products/categories/hoodies.jpg',
    categorySlug: 'hoodies',
    categoryName: 'Hoodies',
  },
  {
    name: 'FORCE TEE',
    meta: 'HEAVY COTTON / SCREEN PRINT',
    href: '/shop',
    image: '/images/products/categories/tees.jpg',
    categorySlug: 'tees',
    categoryName: 'Tees',
  },
  {
    name: 'CLASSIC BEANIE',
    meta: 'CUFFED KNIT / EMBROIDERED MARK',
    href: '/shop',
    image: '/images/products/categories/beanies.jpg',
    categorySlug: 'beanies',
    categoryName: 'Beanies',
  },
  {
    name: 'WORK JACKET',
    meta: 'DUCK CANVAS / LIMITED DROP',
    href: '/shop',
    image: '/images/products/categories/jackets.jpg',
    categorySlug: 'jackets',
    categoryName: 'Jackets',
  },
];

async function parseApiJson(res, fallbackMessage) {
  const contentType = res.headers.get('content-type') || '';
  if (!contentType.includes('application/json')) {
    const body = await res.text();
    const preview = body.replace(/\s+/g, ' ').trim().slice(0, 120);
    if (preview.startsWith('<')) {
      throw new Error(
        'Product API returned HTML instead of JSON. Check NEXT_PUBLIC_API_URL and /api rewrite.'
      );
    }
    throw new Error(fallbackMessage);
  }

  try {
    return await res.json();
  } catch {
    throw new Error('Product API returned invalid JSON.');
  }
}

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
      .then((res) => parseApiJson(res, 'Failed to load categories'))
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
      const data = await parseApiJson(res, 'Failed to load products');

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

  const renderStaticFallback = () => (
    <div className="mt-10">
      <p className="text-av-bone-muted text-[11px] tracking-[2px] uppercase mb-4">
        Temporary featured products while API sync is unavailable
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 text-left">
        {fallbackProducts
          .filter((item) => !activeCategory || item.categorySlug === activeCategory)
          .map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="group border border-av-bone-faint p-4 min-h-[220px] flex flex-col justify-between
                         hover:border-av-red transition-colors"
            >
              <div className="relative w-full aspect-square bg-av-gunmetal/40 border border-av-bone-faint overflow-hidden">
                <img
                  src={item.image}
                  alt={`${item.name} — ${item.categoryName}`}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.src = '/images/logo-home.png';
                  }}
                />
              </div>
              <div className="mt-4">
                <p className="text-[10px] tracking-[2px] text-av-red uppercase mb-1">{item.categoryName}</p>
                <h3 className="font-heading text-[15px] tracking-[2px] group-hover:text-av-red transition-colors">
                  {item.name}
                </h3>
                <p className="text-[10px] tracking-[2px] text-av-bone-muted mt-2">{item.meta}</p>
              </div>
            </a>
          ))}
      </div>
    </div>
  );

  const fallbackCategories = [
    ...new Map(
      fallbackProducts.map((item) => [
        item.categorySlug,
        { slug: item.categorySlug, name: item.categoryName },
      ])
    ).values(),
  ];

  return (
    <section>
      {/* Category Filter Tabs */}
      {(categories.length > 0 || error) && (
        <CategoryFilter
          categories={categories.length > 0 ? categories : fallbackCategories}
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
          {renderStaticFallback()}
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
