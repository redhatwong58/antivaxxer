/**
 * Search Results Page — ANTIVAXXER
 *
 * [AV-028] feat: product search
 */

'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { trackSearch } from '@/lib/analytics';

function SearchContent() {
  const searchParams = useSearchParams();
  const query = searchParams.get('q') || '';
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  const search = useCallback(async () => {
    if (!query.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/search?q=${encodeURIComponent(query)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.products || []);
        trackSearch(query, data.resultCount);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [API_URL, query]);

  useEffect(() => { search(); }, [search]);

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-20">
        <h1 className="font-heading text-3xl tracking-widest text-av-bone mb-2">
          SEARCH RESULTS
        </h1>
        <p className="text-av-bone-muted text-sm mb-8">
          {query ? `Showing results for "${query}"` : 'Enter a search term'}
          {!loading && query && ` — ${results.length} found`}
        </p>

        {loading && (
          <p className="text-av-bone-muted text-sm text-center py-16">Searching...</p>
        )}

        {!loading && query && results.length === 0 && (
          <div className="text-center py-16 border border-av-bone-faint">
            <p className="text-av-bone-muted text-sm mb-4">No products found for &ldquo;{query}&rdquo;</p>
            <Link href="/shop" className="inline-block px-6 py-2 bg-av-red text-av-bone text-xs tracking-widest uppercase">
              Browse All Products
            </Link>
          </div>
        )}

        {results.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {results.map((product) => (
              <Link key={product.id} href={`/shop?product=${product.slug}`}
                className="group border border-av-bone-faint hover:border-av-red transition-colors p-4">
                <div className="aspect-square bg-av-gunmetal mb-3 flex items-center justify-center overflow-hidden">
                  {product.primaryImage ? (
                    <img src={product.primaryImage} alt={product.name} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-heading text-2xl text-av-bone-dim">AV</span>
                  )}
                </div>
                <p className="text-av-bone text-sm truncate group-hover:text-av-red transition-colors">
                  {product.name}
                </p>
                <p className="text-av-bone-muted text-xs">${product.basePrice.toFixed(2)}</p>
                {product.badge && (
                  <span className="text-av-red text-[9px] tracking-widest">{product.badge}</span>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center">
      <p className="text-av-bone-muted text-sm">Loading...</p>
    </div>}>
      <SearchContent />
    </Suspense>
  );
}
