/**
 * Wishlist Page — ANTIVAXXER
 *
 * [AV-029] feat: wishlist
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function WishlistPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/account/login');
  }, [status, router]);

  const fetchWishlist = useCallback(async () => {
    if (!session) return;
    try {
      const res = await fetch(`${API_URL}/account/wishlist`, {
        headers: { Authorization: `Bearer ${session.user.apiToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setItems(data.wishlist || []);
      }
    } catch { /* silent */ }
    finally { setLoading(false); }
  }, [API_URL, session]);

  useEffect(() => { if (session) fetchWishlist(); }, [session, fetchWishlist]);

  const removeItem = async (productId) => {
    await fetch(`${API_URL}/account/wishlist/${productId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${session.user.apiToken}` },
    });
    setItems((prev) => prev.filter((i) => i.productId !== productId));
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center">
      <p className="text-av-bone-muted text-sm tracking-wider">Loading wishlist...</p>
    </div>;
  }

  return (
    <div className="min-h-screen">
      <div className="max-w-5xl mx-auto px-4 py-20">
        <Link href="/account" className="text-av-bone-muted text-xs tracking-wider hover:text-av-bone transition-colors">
          ← My Account
        </Link>
        <h1 className="font-heading text-3xl tracking-widest text-av-bone mt-4 mb-8">WISHLIST</h1>

        {items.length === 0 ? (
          <div className="text-center py-16 border border-av-bone-faint">
            <p className="text-av-bone-muted text-sm mb-4">Your wishlist is empty.</p>
            <Link href="/shop" className="inline-block px-6 py-2 bg-av-red text-av-bone text-xs tracking-widest uppercase">
              Browse Products
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {items.map((item) => (
              <div key={item.productId} className="border border-av-bone-faint p-4 relative group">
                <button onClick={() => removeItem(item.productId)}
                  className="absolute top-2 right-2 text-av-bone-muted hover:text-av-red transition-colors z-10"
                  aria-label={`Remove ${item.name} from wishlist`}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" stroke="none">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </button>
                <Link href={`/shop?product=${item.slug}`}>
                  <div className="aspect-square bg-av-gunmetal mb-3 flex items-center justify-center overflow-hidden">
                    {item.primaryImage ? (
                      <img src={item.primaryImage} alt={item.name} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-heading text-2xl text-av-bone-dim">AV</span>
                    )}
                  </div>
                  <p className="text-av-bone text-sm truncate">{item.name}</p>
                  <p className="text-av-bone-muted text-xs">${item.basePrice.toFixed(2)}</p>
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
