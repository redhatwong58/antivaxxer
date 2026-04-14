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
 */

'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useCart } from '@/components/cart/CartContext';
import { useToast } from '@/components/ui/Toast';
import { trackViewItem, trackAddToCart } from '@/lib/analytics';
import {
  findVariantForSelection,
  filterImagesBySelectedColor,
} from '@/lib/productVariantUtils';
// [AV-039] SEO structured data for product detail pages
import { ProductJsonLd, BreadcrumbJsonLd } from '@/components/seo/JsonLd';

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

  const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const res = await fetch(`${API_URL}/products/${params.slug}`);
        if (!res.ok) throw new Error('Product not found');
        const data = await res.json();
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
  }, [API_URL, params.slug]);

  const filteredImages = useMemo(
    () => filterImagesBySelectedColor(product, selectedColor),
    [product, selectedColor]
  );

  useEffect(() => {
    setActiveImageIndex(0);
  }, [selectedColor]);

  const handleAddToCart = () => {
    const variant = findVariantForSelection(product, selectedColor, selectedSize);
    if (!variant) {
      showToast('Please select a size and color', 'error');
      return;
    }
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

  const selectedVariant = findVariantForSelection(product, selectedColor, selectedSize);
  const displayPrice = selectedVariant?.price || product.basePrice;
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
                    <img src={img.url} alt="" className="w-full h-full object-cover" />
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

            {/* Availability */}
            {selectedVariant && (
              <p className={`text-[10px] tracking-wider mb-4 ${
                selectedVariant.stockQty > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {selectedVariant.stockQty > 0 ? 'In Stock' : 'Out of Stock'}
              </p>
            )}

            {/* Add to Cart */}
            <button
              onClick={handleAddToCart}
              disabled={selectedVariant && selectedVariant.stockQty <= 0}
              className="w-full py-4 bg-av-red text-av-bone text-xs tracking-widest
                         uppercase hover:bg-av-red-hover disabled:opacity-50
                         disabled:cursor-not-allowed transition-colors duration-200"
              aria-label={`Add ${product.name} to cart — $${displayPrice.toFixed(2)}`}
            >
              {selectedVariant?.stockQty <= 0 ? 'Out of Stock' : `Add to Cart — $${displayPrice.toFixed(2)}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
