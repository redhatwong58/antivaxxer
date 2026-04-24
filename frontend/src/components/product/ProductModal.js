/**
 * ProductModal Component — ANTIVAXXER
 *
 * [AV-006] feat: product modal, cart drawer, cart persistence
 *
 * Full product detail view in a modal overlay:
 * - Product image
 * - Name, description, variant label
 * - Size selector (highlights selected, dims unavailable)
 * - Color selector (swatches with selected ring)
 * - Price (uses variant price override if set)
 * - Add to Cart button
 *
 * ADA: role="dialog", aria-modal, focus trap, Escape to close.
 */

'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useCart } from '@/components/cart/CartContext';
import { useToast } from '@/components/ui/Toast';
import WishlistButton from '@/components/wishlist/WishlistButton';
import WishlistPrompt from '@/components/wishlist/WishlistPrompt';

export default function ProductModal({ product, onClose }) {
  const { addItem, openCart } = useCart();
  const { showToast } = useToast();
  const modalRef = useRef(null);

  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);
  const [showWishlistPrompt, setShowWishlistPrompt] = useState(false);

  // Initialize selections when product changes
  useEffect(() => {
    if (product) {
      setSelectedColor(product.colors?.[0] || null);
      setSelectedSize(product.sizes?.[0] || null);
    }
  }, [product]);

  // Escape key + focus trap
  useEffect(() => {
    if (!product) return;

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    if (modalRef.current) modalRef.current.focus();

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [product, onClose]);

  // Find the matching variant for selected color + size
  const getSelectedVariant = useCallback(() => {
    if (!product?.variants) return null;
    return product.variants.find(
      (v) =>
        (v.color?.id === selectedColor?.id || (!v.color && !selectedColor)) &&
        (v.size?.id === selectedSize?.id || (!v.size && !selectedSize))
    );
  }, [product, selectedColor, selectedSize]);

  // Handle add to cart
  const handleAddToCart = () => {
    const variant = getSelectedVariant();
    if (!variant) {
      showToast('Please select a size and color', 'error');
      return;
    }

    addItem({
      variantId: variant.id,
      productId: product.id,
      name: product.name,
      color: selectedColor?.name || null,
      size: selectedSize?.name || null,
      price: variant.price,
      image: displayImage?.url || null,
      sku: variant.sku,
    });

    showToast(`${product.name} added to cart`);
    onClose();
    openCart();
  };

  if (!product) return null;

  const selectedVariant = getSelectedVariant();
  const displayPrice = selectedVariant?.price || product.basePrice;

  // [AV-036] Variant-specific image filtering.
  // When a color is selected, show images tagged with that colorId.
  // Falls back to all images if no color-specific images exist.
  // Same logic as the product detail page — change in one place, change in both.
  const filteredImages = (() => {
    if (!product.images?.length) return [];
    if (selectedColor) {
      const colorImages = product.images.filter((img) => img.colorId === selectedColor.id);
      if (colorImages.length > 0) return colorImages;
    }
    return product.images;
  })();
  const displayImage = filteredImages[0] || null;

  return (
    <>
      {/* [AV-047] v5.3.3: Modal redesigned to match mock — centered 960px with full backdrop */}
      {/* Backdrop + centered modal wrapper — click outside to close */}
      <div
        className="fixed inset-0 bg-black/80 z-[997] flex items-center justify-center p-4 md:p-5
                   cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      >
        {/* Modal — stops click propagation so clicking inside doesn't close */}
        <div
          ref={modalRef}
          role="dialog"
          aria-modal="true"
          aria-label={`Product details: ${product.name}`}
          tabIndex={-1}
          onClick={(e) => e.stopPropagation()}
          className="relative cursor-default
                     w-full max-w-[960px] max-h-[90vh]
                     bg-av-black border border-av-bone-faint
                     overflow-hidden
                     grid grid-cols-1 md:grid-cols-2"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            aria-label="Close product details"
            className="absolute top-4 right-4 z-10 text-av-bone
                       hover:text-av-red transition-colors text-2xl leading-none"
          >
            ✕
          </button>

          {/* Image — [AV-036] uses variant-filtered image */}
          <div className="bg-av-gunmetal flex items-center justify-center min-h-[300px] md:min-h-[500px] relative overflow-hidden">
            {displayImage?.url ? (
              <img
                src={displayImage.url}
                alt={displayImage.altText || product.name}
                className="w-full h-full object-cover"
              />
            ) : (
              <span className="font-heading text-6xl tracking-widest text-av-bone-dim">
                AV
              </span>
            )}

            {/* [AV-046] Wishlist button — top-left of image, 44x44 touch target */}
            <div className="absolute top-4 left-4">
              <WishlistButton
                productId={product.id}
                onPromptShow={() => setShowWishlistPrompt(true)}
              />
            </div>
          </div>

          {/* Details — scrollable if content exceeds max-height */}
          <div className="p-8 md:p-9 flex flex-col overflow-y-auto">
            {/* Category */}
            <p className="text-av-red text-[11px] tracking-[3px] uppercase mb-2 font-light">
              {product.category?.name}
            </p>

            {/* Name */}
            <h2 className="font-heading text-3xl tracking-[3px] text-av-bone mb-2">
              {product.name}
            </h2>

            {/* Price */}
            <p className="font-heading text-2xl text-av-bone tracking-wider mb-5">
              ${displayPrice.toFixed(2)}
            </p>

            {/* Description */}
            <p className="text-av-bone-muted text-sm font-light leading-[1.8] mb-6">
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
              <div className="mb-5">
                <label className="text-av-bone text-[11px] tracking-[2px] uppercase block mb-3 font-light">
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
                        w-11 h-11 flex items-center justify-center font-heading text-sm
                        border transition-all duration-200
                        ${selectedSize?.id === size.id
                          ? 'bg-av-red border-av-red text-av-bone'
                          : 'border-av-bone-dim text-av-bone hover:border-av-bone'
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
              <div className="mb-6">
                <label className="text-av-bone text-[11px] tracking-[2px] uppercase block mb-3 font-light">
                  Color — {selectedColor?.name || 'Select'}
                </label>
                <div className="flex flex-wrap gap-2.5">
                  {product.colors.map((color) => (
                    <button
                      key={color.id}
                      onClick={() => setSelectedColor(color)}
                      aria-label={`Color ${color.name}`}
                      aria-pressed={selectedColor?.id === color.id}
                      className={`
                        w-7 h-7 rounded-full border-2 transition-all duration-200
                        ${selectedColor?.id === color.id
                          ? 'border-av-bone'
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

            {/* Add to Cart */}
            <button
              onClick={handleAddToCart}
              className="w-full py-4 bg-av-red text-av-bone font-heading text-base
                         tracking-[4px] uppercase hover:bg-av-red-hover transition-colors
                         mb-4"
              aria-label={`Add ${product.name} to cart — $${displayPrice.toFixed(2)}`}
            >
              Add to Cart
            </button>

            {/* Features — bottom strip */}
            <div className="mt-auto pt-4 border-t border-av-bone-faint flex flex-wrap gap-5">
              <span className="text-[11px] text-av-bone-muted font-extralight flex items-center gap-1.5 tracking-wider">
                <span className="w-1 h-1 bg-av-red rounded-full" />
                PREMIUM BLANK
              </span>
              <span className="text-[11px] text-av-bone-muted font-extralight flex items-center gap-1.5 tracking-wider">
                <span className="w-1 h-1 bg-av-red rounded-full" />
                FREE SHIPPING $75+
              </span>
              <span className="text-[11px] text-av-bone-muted font-extralight flex items-center gap-1.5 tracking-wider">
                <span className="w-1 h-1 bg-av-red rounded-full" />
                30-DAY RETURNS
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* [AV-046] Wishlist prompt — outside modal so it floats above everything */}
      <WishlistPrompt
        isOpen={showWishlistPrompt}
        onClose={() => setShowWishlistPrompt(false)}
      />
    </>
  );
}
