/**
 * Toast Notification Component — ANTIVAXXER
 *
 * [AV-004] feat: core layout, navigation, theme
 *
 * Global toast notification system.
 * Used for: "Added to cart", "Promo applied", validation errors, etc.
 *
 * Usage from any component:
 *   import { useToast } from '@/components/ui/Toast';
 *   const { showToast } = useToast();
 *   showToast('Item added to cart');
 *   showToast('Error: out of stock', 'error');
 *
 * ADA: role="status" + aria-live="polite" for screen reader announcements.
 */

'use client';

import { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [timeoutId, setTimeoutId] = useState(null);

  const showToast = useCallback((message, type = 'success', duration = 3000) => {
    // Clear existing toast timer
    if (timeoutId) clearTimeout(timeoutId);

    setToast({ message, type });

    const id = setTimeout(() => {
      setToast(null);
    }, duration);
    setTimeoutId(id);
  }, [timeoutId]);

  const dismissToast = useCallback(() => {
    if (timeoutId) clearTimeout(timeoutId);
    setToast(null);
  }, [timeoutId]);

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}

      {/* Toast Element */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`
            fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999]
            px-6 py-3 max-w-md
            text-sm tracking-wider
            shadow-lg
            animate-toast-in
            ${toast.type === 'error'
              ? 'bg-av-red text-white'
              : toast.type === 'warning'
                ? 'bg-av-gold text-av-black'
                : 'bg-av-gunmetal text-av-bone border border-av-bone-dim'
            }
          `}
        >
          <div className="flex items-center gap-3">
            <span className="flex-1">{toast.message}</span>
            <button
              onClick={dismissToast}
              aria-label="Dismiss notification"
              className="text-current opacity-60 hover:opacity-100 transition-opacity"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                   stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  );
}
