/**
 * Cart Context — ANTIVAXXER
 *
 * [AV-006] feat: product modal, cart drawer, cart persistence
 *
 * Global cart state via React Context.
 * Persists to localStorage so cart survives page refresh.
 * Phase 3 adds server-side sync for logged-in users.
 *
 * Usage:
 *   import { useCart } from '@/components/cart/CartContext';
 *   const { cart, addItem, removeItem, updateQty, cartTotal, cartCount } = useCart();
 */

'use client';

import { createContext, useContext, useState, useEffect, useCallback } from 'react';

const CartContext = createContext(null);
const CART_STORAGE_KEY = 'antivaxxer_cart';

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export function CartProvider({ children }) {
  const [cart, setCart] = useState([]);
  const [isOpen, setIsOpen] = useState(false);
  const [initialized, setInitialized] = useState(false);

  // Load cart from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(CART_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setCart(parsed);
        }
      }
    } catch {
      // Corrupted storage — start fresh
      localStorage.removeItem(CART_STORAGE_KEY);
    }
    setInitialized(true);
  }, []);

  // Save cart to localStorage on every change (after initial load)
  useEffect(() => {
    if (initialized) {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart));
    }
  }, [cart, initialized]);

  // Add item to cart
  // item shape: { variantId, productId, name, color, size, price, image, sku, qty }
  const addItem = useCallback((item) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.variantId === item.variantId);
      if (existing) {
        // Increment quantity (max 99 per Security Standards — input validation)
        return prev.map((i) =>
          i.variantId === item.variantId
            ? { ...i, qty: Math.min(i.qty + (item.qty || 1), 99) }
            : i
        );
      }
      return [...prev, { ...item, qty: item.qty || 1 }];
    });
  }, []);

  // Remove item from cart
  const removeItem = useCallback((variantId) => {
    setCart((prev) => prev.filter((i) => i.variantId !== variantId));
  }, []);

  // Update quantity
  const updateQty = useCallback((variantId, qty) => {
    const safeQty = Math.max(1, Math.min(qty, 99));
    setCart((prev) =>
      prev.map((i) => (i.variantId === variantId ? { ...i, qty: safeQty } : i))
    );
  }, []);

  // Clear cart
  const clearCart = useCallback(() => {
    setCart([]);
  }, []);

  // [AV-034] Replace entire cart contents (used by abandoned cart recovery).
  // Validates that items is an array before replacing. If validation fails,
  // the existing cart is preserved — no silent data loss.
  // To rollback: remove this function and its reference in the Provider value.
  const replaceCart = useCallback((items) => {
    if (!Array.isArray(items)) {
      console.error('[CART] replaceCart received non-array:', typeof items);
      return;
    }
    setCart(items);
  }, []);

  // Open/close cart drawer
  const openCart = useCallback(() => setIsOpen(true), []);
  const closeCart = useCallback(() => setIsOpen(false), []);

  // Computed values
  const cartCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const cartTotal = cart.reduce((sum, item) => sum + item.price * item.qty, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        isOpen,
        initialized,
        addItem,
        removeItem,
        updateQty,
        clearCart,
        replaceCart,
        openCart,
        closeCart,
        cartCount,
        cartTotal,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}
