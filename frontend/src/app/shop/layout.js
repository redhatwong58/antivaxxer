/**
 * Shop Layout — provides SEO metadata for the shop page.
 * The shop page itself is a client component (needs useState for filters),
 * so metadata is exported from this server component layout instead.
 */

export const metadata = {
  title: 'Shop',
  description:
    'Shop ANTIVAXXER premium streetwear. Comfort Colors tees, hoodies, hats, and brand collaborations.',
};

export default function ShopLayout({ children }) {
  return children;
}
