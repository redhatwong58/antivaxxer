/**
 * Root Layout — ANTIVAXXER
 * [AV-037] Updated: v5.2.0 UI overhaul — added AnnouncementBar, SocialFloatBar, PromoPopup
 */
import '../styles/globals.css';
import Script from 'next/script';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { ToastProvider } from '@/components/ui/Toast';
import { CartProvider } from '@/components/cart/CartContext';
import CartDrawer from '@/components/cart/CartDrawer';
import AuthProvider from '@/components/auth/AuthProvider';
import { OrganizationJsonLd } from '@/components/seo/JsonLd';
import { GoogleAnalytics } from '@/lib/analytics';
import AnnouncementBar from '@/components/home/AnnouncementBar';
import SocialFloatBar from '@/components/home/SocialFloatBar';
import PromoPopup from '@/components/home/PromoPopup';

export const metadata = {
  title: { default: 'ANTIVAXXER — Streetwear with a Statement', template: '%s | ANTIVAXXER' },
  description: 'Premium streetwear for the health freedom movement. Comfort Colors, Carhartt, Columbia PFG, Vineyard Vines collaborations.',
  openGraph: {
    title: 'ANTIVAXXER — Streetwear with a Statement',
    description: 'Premium streetwear for the health freedom movement.',
    url: 'https://www.antivaxxer.com', siteName: 'ANTIVAXXER', type: 'website',
  },
  twitter: { card: 'summary_large_image', title: 'ANTIVAXXER', description: 'Premium streetwear for the health freedom movement.' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {process.env.NEXT_PUBLIC_COOKIESYES_ID && (
          <Script id="cookieyes" src={`https://cdn-cookieyes.com/client_data/${process.env.NEXT_PUBLIC_COOKIESYES_ID}/script.js`} strategy="beforeInteractive" />
        )}
        <OrganizationJsonLd />
        <GoogleAnalytics />
        <a href="#main-content" className="skip-to-content">Skip to content</a>
        <AuthProvider>
        <ToastProvider>
          <CartProvider>
            <AnnouncementBar />
            <Header />
            <SocialFloatBar />
            <PromoPopup />
            <main id="main-content" role="main" className="min-h-screen">
              {children}
            </main>
            <Footer />
            <CartDrawer />
          </CartProvider>
        </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
