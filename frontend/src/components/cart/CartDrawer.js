/**
 * Cart Drawer — ANTIVAXXER
 * [AV-037] Rewritten: v5.2.0 — 460px wide, qty controls, shipping line, branded styling
 */
'use client';
import { useCart } from './CartContext';
import Link from 'next/link';

export default function CartDrawer() {
  const { cart, isOpen, closeCart, removeItem, updateQty, cartTotal } = useCart();

  return (
    <>
      {/* Overlay */}
      <div className={`fixed inset-0 bg-black/60 z-[200] transition-opacity duration-300
        ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={closeCart} aria-hidden="true" />

      {/* Drawer */}
      <div className={`fixed top-0 right-0 w-[460px] max-w-full h-full bg-av-black
        border-l border-av-bone-faint z-[201] flex flex-col transition-transform duration-400
        ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog" aria-modal="true" aria-label="Shopping cart">

        {/* Header */}
        <div className="flex justify-between items-center px-8 py-6 border-b border-av-bone-faint">
          <h3 className="font-heading text-2xl tracking-[4px]">CART</h3>
          <button onClick={closeCart} aria-label="Close cart"
            className="text-av-bone text-2xl hover:text-av-red transition-colors bg-transparent border-none cursor-pointer">
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-8 py-8">
          {cart.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-av-bone-muted text-sm font-light mb-6">Your cart is empty.</p>
              <button onClick={closeCart}
                className="px-8 py-3 border border-av-bone-dim text-av-bone text-xs tracking-[3px]
                           uppercase hover:border-av-red hover:text-av-red transition-colors
                           bg-transparent cursor-pointer">
                Continue Shopping
              </button>
            </div>
          ) : (
            cart.map((item, i) => (
              <div key={item.variantId || i} className="flex gap-4 mb-6 pb-6 border-b border-av-bone-faint last:border-0">
                {/* Image */}
                <div className="w-20 h-20 bg-av-gunmetal flex-shrink-0 overflow-hidden">
                  {item.image ? (
                    <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="font-heading text-xs text-av-bone-dim">AV</span>
                    </div>
                  )}
                </div>
                {/* Details */}
                <div className="flex-1">
                  <p className="text-av-bone text-sm font-normal mb-1">{item.name}</p>
                  <p className="text-av-bone-muted text-[11px] font-light mb-3">
                    {[item.color, item.size].filter(Boolean).join(' / ')}
                  </p>
                  <div className="flex justify-between items-center">
                    {/* Qty controls */}
                    <div className="flex items-center gap-3 border border-av-bone-dim px-2 py-1">
                      <button onClick={() => updateQty(item.variantId, item.qty - 1)}
                        className="bg-transparent border-none text-av-bone cursor-pointer text-sm px-1"
                        aria-label="Decrease quantity">−</button>
                      <span className="font-heading text-base min-w-[20px] text-center">{item.qty}</span>
                      <button onClick={() => updateQty(item.variantId, item.qty + 1)}
                        className="bg-transparent border-none text-av-bone cursor-pointer text-sm px-1"
                        aria-label="Increase quantity">+</button>
                    </div>
                    <span className="font-heading text-base">${(item.price * item.qty).toFixed(2)}</span>
                  </div>
                  <button onClick={() => removeItem(item.variantId)}
                    className="bg-transparent border-none text-av-bone-muted text-[11px] tracking-wider
                               uppercase font-light cursor-pointer hover:text-av-red transition-colors mt-2">
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {cart.length > 0 && (
          <div className="px-8 py-6 border-t border-av-bone-faint">
            <div className="flex justify-between mb-2">
              <span className="text-sm font-light text-av-bone-muted">Subtotal</span>
              <span className="font-heading text-lg">${cartTotal.toFixed(2)}</span>
            </div>
            <p className="text-[11px] text-av-bone-muted font-light mb-5">
              {cartTotal >= 75 ? 'Free shipping!' : `$${(75 - cartTotal).toFixed(2)} away from free shipping`}
            </p>
            <Link href="/checkout" onClick={closeCart}
              className="block w-full py-4 bg-av-red text-av-bone font-heading text-base
                         tracking-[4px] text-center hover:bg-av-red-hover transition-colors">
              CHECKOUT
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
