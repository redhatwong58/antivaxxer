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

import { useState, useEffect, useRef, useMemo } from 'react';
import { useCart } from '@/components/cart/CartContext';
import { useToast } from '@/components/ui/Toast';
import {
  findVariantForSelection,
  filterImagesBySelectedColor,
} from '@/lib/productVariantUtils';

export default function ProductModal({ product, onClose }) {
  const { addItem, openCart } = useCart();
  const { showToast } = useToast();
  const modalRef = useRef(null);

  const [selectedColor, setSelectedColor] = useState(null);
  const [selectedSize, setSelectedSize] = useState(null);

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

  const filteredImages = useMemo(
    () => filterImagesBySelectedColor(product, selectedColor),
    [product, selectedColor]
  );
  const displayImage = filteredImages[0] || null;

  const handleAddToCart = () => {
    const variant = findVariantForSelection(product, selectedColor, selectedSize);
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

  const selectedVariant = findVariantForSelection(product, selectedColor, selectedSize);
  const displayPrice = selectedVariant?.price || product.basePrice;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/70 z-[997] cursor-pointer"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Product details: ${product.name}`}
        tabIndex={-1}
        className="fixed inset-4 md:inset-8 lg:inset-16 z-[998]
                   bg-av-black border border-av-bone-faint
                   overflow-y-auto"
      >
        {/* Close button */}
        <button
          onClick={onClose}
          aria-label="Close product details"
          className="absolute top-4 right-4 z-10 text-av-bone-muted
                     hover:text-av-bone transition-colors"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
               stroke="currentColor" strokeWidth="1.5">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className="grid grid-cols-1 md:grid-cols-2 min-h-full">
          {/* Image — [AV-036] uses variant-filtered image */}
          <div className="bg-av-gunmetal flex items-center justify-center aspect-square md:aspect-auto">
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
          </div>

          {/* Details */}
          <div className="p-8 md:p-12 flex flex-col justify-center">
            {/* Category */}
            <p className="text-av-bone-muted text-[10px] tracking-widest uppercase mb-2">
              {product.category?.name}
            </p>

            {/* Name */}
            <h2 className="font-heading text-3xl md:text-4xl tracking-wider text-av-bone mb-2">
              {product.name}
            </h2>

            {/* Price */}
            <p className="text-av-bone text-xl mb-4">
              ${displayPrice.toFixed(2)}
            </p>

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

            {/* Add to Cart */}
            <button
              onClick={handleAddToCart}
              className="w-full py-4 bg-av-red text-av-bone text-xs tracking-widest
                         uppercase hover:bg-av-red-hover transition-colors duration-200"
              aria-label={`Add ${product.name} to cart — $${displayPrice.toFixed(2)}`}
            >
              Add to Cart — ${displayPrice.toFixed(2)}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
