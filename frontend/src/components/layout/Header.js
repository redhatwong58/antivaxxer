/**
 * Header Component — ANTIVAXXER
 * [AV-037] Rewritten: v5.2.0 UI overhaul to match v9 mock
 *
 * Logo with red X: ANTIVA(red)X(red)XER
 * Nav links with animated underline on hover
 * Backdrop blur on scroll. Search + User + Cart icons.
 * Mobile hamburger menu.
 *
 * Logo: uses /images/logo-nav.png if available (40px height), else styled text.
 * To rollback: cp _rollback/v5.1.0/components/layout/Header.js frontend/src/components/layout/Header.js
 */

'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useCart } from '@/components/cart/CartContext';
import { useWishlist } from '@/components/wishlist/WishlistContext';

export default function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { cartCount, openCart } = useCart();
  const { wishlistCount } = useWishlist();
  const { data: session } = useSession();

  const navLinks = [
    { href: '/', label: 'Shop' },
    { href: '/about', label: 'About' },
    { href: '/faq', label: 'FAQ' },
    { href: '/resources', label: 'Resources' },
  ];

  return (
    <div className="sticky top-0 z-[99] bg-av-black/95 border-b border-av-bone-faint backdrop-blur-[20px]">
      <nav className="max-w-[1400px] mx-auto flex items-center justify-between px-6 md:px-10 py-4">
        {/* Logo — swap /images/logo-nav.png for custom logo */}
        <Link href="/" className="hover:opacity-80 transition-opacity">
          <img src="/images/logo-nav.png" alt="ANTIVAXXER" className="h-8"
            onError={(e) => { e.target.style.display='none'; e.target.nextSibling.style.display='block'; }} />
          <span className="font-heading text-[26px] tracking-[4px]" style={{ display: 'none' }}>
            ANTIVA<span className="text-av-red">X</span>XER
          </span>
        </Link>

        {/* Desktop nav */}
        <ul className="hidden md:flex items-center gap-8 list-none">
          {navLinks.map((link) => (
            <li key={link.href}>
              <Link href={link.href}
                className="nav-underline text-av-bone font-light text-[13px] tracking-[2px] uppercase transition-colors">
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Icons */}
        <div className="flex items-center gap-3">
          {/* Search */}
          <Link href="/search" aria-label="Search" className="w-9 h-9 flex items-center justify-center
                      text-av-bone hover:scale-110 transition-transform">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </Link>

          {/* Wishlist — [AV-046] v5.3.3 */}
          <Link href="/account/wishlist" aria-label={`Wishlist, ${wishlistCount} items`}
            className="w-9 h-9 flex items-center justify-center text-av-bone
                       hover:scale-110 transition-transform relative">
            <svg width="18" height="18" viewBox="0 0 24 24"
                 fill={wishlistCount > 0 ? '#6A0E0E' : 'none'}
                 stroke={wishlistCount > 0 ? '#6A0E0E' : 'currentColor'} strokeWidth="1.5">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {wishlistCount > 0 && (
              <span className="absolute -top-0.5 -right-1 bg-av-red text-white text-[10px]
                               font-heading w-[18px] h-[18px] rounded-full flex items-center justify-center">
                {wishlistCount}
              </span>
            )}
          </Link>

          {/* Account */}
          <Link href={session ? '/account' : '/account/login'} aria-label="Account"
            className="w-9 h-9 flex items-center justify-center text-av-bone hover:scale-110 transition-transform">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/>
            </svg>
          </Link>

          {/* Cart */}
          <button onClick={openCart} aria-label={`Cart, ${cartCount} items`}
            className="w-9 h-9 flex items-center justify-center text-av-bone
                       hover:scale-110 transition-transform relative">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/>
              <line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/>
            </svg>
            {cartCount > 0 && (
              <span className="absolute -top-0.5 -right-1 bg-av-red text-white text-[10px]
                               font-heading w-[18px] h-[18px] rounded-full flex items-center justify-center">
                {cartCount}
              </span>
            )}
          </button>

          {/* Mobile hamburger */}
          <button className="md:hidden w-9 h-9 flex items-center justify-center text-av-bone"
            onClick={() => setMobileOpen(!mobileOpen)} aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}>
            {mobileOpen ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/>
                <line x1="3" y1="18" x2="21" y2="18"/>
              </svg>
            )}
          </button>
        </div>
      </nav>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="md:hidden border-t border-av-bone-faint py-4 px-6" aria-label="Mobile navigation">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href}
              className="block py-3 text-av-bone-muted text-sm tracking-widest uppercase hover:text-av-bone transition-colors"
              onClick={() => setMobileOpen(false)}>
              {link.label}
            </Link>
          ))}
          <Link href={session ? '/account' : '/account/login'}
            className="block py-3 text-av-bone-muted text-sm tracking-widest uppercase hover:text-av-bone transition-colors"
            onClick={() => setMobileOpen(false)}>
            {session ? 'My Account' : 'Login'}
          </Link>
        </nav>
      )}
    </div>
  );
}
