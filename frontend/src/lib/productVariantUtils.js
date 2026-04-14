/**
 * Shared product variant + image helpers (ProductModal, product detail page).
 */

export function findVariantForSelection(product, selectedColor, selectedSize) {
  if (!product?.variants) return null;
  return product.variants.find(
    (v) =>
      (v.color?.id === selectedColor?.id || (!v.color && !selectedColor)) &&
      (v.size?.id === selectedSize?.id || (!v.size && !selectedSize))
  );
}

/** When a color is selected, prefer images tagged with that color; else all images. */
export function filterImagesBySelectedColor(product, selectedColor) {
  if (!product?.images?.length) return [];
  if (selectedColor) {
    const colorImages = product.images.filter((img) => img.colorId === selectedColor.id);
    if (colorImages.length > 0) return colorImages;
  }
  return product.images;
}
