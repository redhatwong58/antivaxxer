/**
 * Product Detail Page — ANTIVAXXER
 *
 * [AV-035] feat: product detail page with variant-specific images
 *
 * Full product page at /shop/{slug}. Replaces the modal as the primary
 * product view for SEO (each product gets its own URL with structured data).
 * The modal remains available as "Quick View" on the product grid.
 *
 * Features:
 *   - Image gallery with variant-specific filtering by color
 *   - Size + color selectors (same logic as ProductModal)
 *   - Add to cart with toast notification
 *   - JSON-LD Product + Breadcrumb structured data
 *   - Dynamic metadata (title, description, Open Graph)
 *
 * To rollback: delete this file. ProductCard's Link will 404, but the
 * Quick View button still works. Revert ProductCard to use the button-only
 * version from v5.0.0.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useCart } from '@/components/cart/CartContext';
import { useToast } from '@/components/ui/Toast';
import { trackViewItem, trackAddToCart } from '@/lib/analytics';
// [AV-039] SEO structured data for product detail pages
import { ProductJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';
// [AV-046] v5.3.3 — wishlist
import WishlistButton from '@/components/wishlist/WishlistButton';
import WishlistPrompt from '@/components/wishlist/WishlistPrompt';
import { api } from '@/lib/api';

export default function ProductDetailPage() {
  const params = useParams();
  const { addItem, openCart } = useCart();
  const { showToast } = useToast();

  const [product, setProduct] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [showWishlistPrompt, setShowWishlistPrompt] = useState(false);

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const data = await api.get(`/products/${params.slug}`);
        setProduct(data.product);
        setSelectedColor(data.product.colors?.[0] || null);
        setSelectedSize(data.product.sizes?.[0] || null);
        trackViewItem({
          slug: data.product.slug,
          name: data.product.name,
          price: data.product.basePrice,
          category: data.product.category?.name,
        });
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [params.slug]);

  // [AV-036] Variant-specific image filtering.
  // When a color is selected, show only images tagged with that colorId.
  // Falls back to all images if no color-specific images exist.
  // This filtering applies to both this page and the modal (see ProductModal.js).
  const getFilteredImages = useCallback(() => {
    if (!product?.images?.length) return [];

    if (selectedColor) {
      const colorImages = product.images.filter(
        (img) => img.colorId === selectedColor.id
      );
      // Only filter if this color has specific images. Otherwise show all.
      if (colorImages.length > 0) return colorImages;
    }

    return product.images;
  }, [product, selectedColor]);

  // Reset active image when filtered images change
  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedColor]);

  // Find matching variant
  const getSelectedVariant = useCallback(() => {
    if (!product?.variants) return null;
    return product.variants.find(
      (v) =>
        (v.color?.id === selectedColor?.id || (!v.color && !selectedColor)) &&
        (v.size?.id === selectedSize?.id || (!v.size && !selectedSize))
    );
  }, [product, selectedColor, selectedSize]);

  const handleAddToCart = () => {
    const variant = getSelectedVariant();
    if (!variant) {
      showToast('Please select a size and color', 'error');
      return;
    }

    const filteredImages = getFilteredImages();
    const item = {
      variantId: variant.id,
      productId: product.id,
      name: product.name,
      color: selectedColor?.name || null,
      size: selectedSize?.name || null,
      price: variant.price,
      image: filteredImages[0]?.url || null,
      sku: variant.sku,
    };

    addItem(item);
    trackAddToCart(item);
    showToast(`${product.name} added to cart`);
    openCart();
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-av-bone-muted text-sm tracking-wider">Loading...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center">
          <h1 className="font-heading text-2xl tracking-widest text-av-bone mb-4">
            PRODUCT NOT FOUND
          </h1>
          <Link href="/shop" className="text-av-red text-sm hover:underline">
            ← Back to Shop
          </Link>
        </div>
      </div>
    );
  }

  const selectedVariant = getSelectedVariant();
  const displayPrice = selectedVariant?.price || product.basePrice;
  const filteredImages = getFilteredImages();
  const activeImage = filteredImages[activeImageIndex] || filteredImages[0];

  return (
    <div className="min-h-screen">
      {/* [AV-039] SEO structured data — Google rich snippets */}
      <ProductJsonLd product={product} />
      <BreadcrumbJsonLd items={[
        { name: 'Home', url: '/' },
        { name: 'Shop', url: '/shop' },
        ...(product.category ? [{ name: product.category.name, url: `/shop?category=${product.category.slug}` }] : []),
        { name: product.name, url: `/shop/${product.slug}` },
      ]} />

      {/* Breadcrumbs */}
      <nav className="max-w-6xl mx-auto px-4 pt-20 pb-4" aria-label="Breadcrumb">
        <ol className="flex items-center gap-2 text-[10px] tracking-wider">
          <li><Link href="/" className="text-av-bone-muted hover:text-av-bone">Home</Link></li>
          <li className="text-av-bone-dim">/</li>
          <li><Link href="/shop" className="text-av-bone-muted hover:text-av-bone">Shop</Link></li>
          {product.category && (
            <>
              <li className="text-av-bone-dim">/</li>
              <li className="text-av-bone-muted">{product.category.name}</li>
            </>
          )}
          <li className="text-av-bone-dim">/</li>
          <li className="text-av-bone">{product.name}</li>
        </ol>
      </nav>

      <div className="max-w-6xl mx-auto px-4 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">

          {/* Image Gallery */}
          <div>
            {/* Main Image */}
            <div className="aspect-square bg-av-gunmetal overflow-hidden mb-3">
              {activeImage?.url ? (
                <img
                  src={activeImage.url}
                  alt={activeImage.altText || product.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="font-heading text-6xl tracking-widest text-av-bone-dim">AV</span>
                </div>
              )}
            </div>

            {/* Thumbnail Strip — only show if multiple images */}
            {filteredImages.length > 1 && (
              <div className="flex gap-2 overflow-x-auto">
                {filteredImages.map((img, i) => (
                  <button
                    key={img.id || i}
                    onClick={() => setActiveImageIndex(i)}
                    className={`w-16 h-16 flex-shrink-0 bg-av-gunmetal overflow-hidden border-2 transition-colors
                      ${activeImageIndex === i ? 'border-av-bone' : 'border-transparent hover:border-av-bone-dim'}`}
                    aria-label={`View image ${i + 1}`}
                  >
                    <Image src={img.url} alt="" width={64} height={64} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Product Details */}
          <div className="flex flex-col justify-center">
            {/* Category */}
            <p className="text-av-bone-muted text-[10px] tracking-widest uppercase mb-2">
              {product.category?.name}
            </p>

            {/* Name */}
            <h1 className="font-heading text-3xl md:text-4xl tracking-wider text-av-bone mb-2">
              {product.name}
            </h1>

            {/* Price */}
            <p className="text-av-bone text-xl mb-4">
              ${displayPrice.toFixed(2)}
            </p>

            {/* Badge */}
            {product.badge && (
              <span className="inline-block bg-av-red text-white text-[9px] font-bold
                               tracking-widest px-2 py-1 mb-4 self-start">
                {product.badge}
              </span>
            )}

            {/* Description */}
            <p className="text-av-bone-muted text-sm font-light leading-relaxed mb-6">
              {product.description}
            </p>

            {/* Variant Label */}
            {product.variantLabel && (
              <p className="text-av-bone-muted text-[10px] tracking-wider mb-6">
                {product.variantLabel}
              </p>
            )}

            {/* Size Selector */}
            {product.sizes?.length > 0 && (
              <div className="mb-6">
                <label className="text-av-bone text-[10px] tracking-widest uppercase block mb-3">
                  Select Size
                </label>
                <div className="flex flex-wrap gap-2">
                  {product.sizes.map((size) => (
                    <button
                      key={size.id}
                      onClick={() => setSelectedSize(size)}
                      aria-label={`Size ${size.name}`}
                      aria-pressed={selectedSize?.id === size.id}
                      className={`
                        w-12 h-10 flex items-center justify-center text-xs tracking-wider
                        border transition-all duration-200
                        ${selectedSize?.id === size.id
                          ? 'border-av-bone text-av-bone bg-av-bone/10'
                          : 'border-av-bone-dim text-av-bone-muted hover:border-av-bone hover:text-av-bone'
                        }
                      `}
                    >
                      {size.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Color Selector */}
            {product.colors?.length > 0 && (
              <div className="mb-8">
                <label className="text-av-bone text-[10px] tracking-widest uppercase block mb-3">
                  Color — {selectedColor?.name || 'Select'}
                </label>
                <div className="flex flex-wrap gap-3">
                  {product.colors.map((color) => (
                    <button
                      key={color.id}
                      onClick={() => setSelectedColor(color)}
                      aria-label={`Color ${color.name}`}
                      aria-pressed={selectedColor?.id === color.id}
                      className={`
                        w-8 h-8 rounded-full border-2 transition-all duration-200
                        ${selectedColor?.id === color.id
                          ? 'border-av-bone scale-110'
                          : 'border-transparent hover:border-av-bone-dim'
                        }
                      `}
                      style={{ backgroundColor: color.hexCode }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Availability — hidden for coming_soon since there's no purchase */}
            {selectedVariant && product.status !== 'coming_soon' && (
              <p className={`text-[10px] tracking-wider mb-4 ${
                selectedVariant.inStock ? 'text-green-400' : 'text-red-400'
              }`}>
                {product.status === 'prelaunch'
                  ? 'Pre-Order — ships at launch'
                  : selectedVariant.inStock ? 'In Stock' : 'Out of Stock'}
              </p>
            )}

            {/* [AV-051] v5.3.7 — buy button branches by product status:
                  coming_soon → no buy button at all, "Coming Soon" message instead
                  prelaunch  → "Pre-Order" button (still adds to cart)
                  active     → normal Add to Cart */}
            <div className="flex gap-3">
              {product.status === 'coming_soon' ? (
                <div
                  className="flex-1 py-4 bg-blue-900/30 border border-blue-700 text-center
                             text-av-bone text-xs tracking-widest uppercase font-heading"
                  aria-live="polite"
                >
                  Coming Soon
                </div>
              ) : (
                <button
                  onClick={handleAddToCart}
                  disabled={selectedVariant && !selectedVariant.inStock}
                  className="flex-1 py-4 bg-av-red text-av-bone text-xs tracking-widest
                             uppercase hover:bg-av-red-hover disabled:opacity-50
                             disabled:cursor-not-allowed transition-colors duration-200"
                  aria-label={
                    product.status === 'prelaunch'
                      ? `Pre-order ${product.name} — $${displayPrice.toFixed(2)}`
                      : `Add ${product.name} to cart — $${displayPrice.toFixed(2)}`
                  }
                >
                  {product.status === 'prelaunch'
                    ? `Pre-Order — $${displayPrice.toFixed(2)}`
                    : !selectedVariant?.inStock
                    ? 'Out of Stock'
                    : `Add to Cart — $${displayPrice.toFixed(2)}`}
                </button>
              )}
              {/* Wishlist heart — 56x56 to match button height; works for all statuses */}
              <WishlistButton
                productId={product.id}
                size="lg"
                onPromptShow={() => setShowWishlistPrompt(true)}
                className="!w-14 !h-14"
              />
            </div>
          </div>
        </div>
      </div>

      {/* [AV-046] Wishlist prompt */}
      <WishlistPrompt
        isOpen={showWishlistPrompt}
        onClose={() => setShowWishlistPrompt(false)}
      />
    </div>
  );
}
