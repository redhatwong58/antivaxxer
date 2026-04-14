/**
 * ANTIVAXXER — Database Seed Script
 *
 * [AV-002] feat: seed script with 16 products and variant matrix
 *
 * Seeds all 16 products from the v9 mock with:
 * - 7 categories
 * - 8 colors
 * - 7 sizes
 * - ~150 variant SKUs (product x color x size)
 *
 * Run: cd api && npm run db:seed
 * Requires: DATABASE_URL set in .env, migrations already run
 */

require('../loadEnv');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ===== SKU GENERATION =====
// Format: AV-{CATEGORY_CODE}-{COLOR_CODE}-{SIZE}
const SKU_CATEGORY_CODES = {
  tees: 'TEE',
  'long-sleeve': 'LS',
  crewneck: 'CREW',
  hoodie: 'HOOD',
  hat: 'HAT',
  collab: 'CLB',
  accessories: 'ACC',
};

const SKU_COLOR_CODES = {
  Black: 'BLK',
  Pepper: 'PPR',
  'Blue Jean': 'BJN',
  Grey: 'GRY',
  White: 'WHT',
  'Black/Black': 'BB',
  'Red/Black': 'RB',
  'Black (Full Logo)': 'BFL',
  Charcoal: 'CHR',
  'Light Blue': 'LBL',
};

function generateSku(categorySlug, colorName, sizeName, productIndex) {
  const catCode = SKU_CATEGORY_CODES[categorySlug] || 'GEN';
  const colorCode = SKU_COLOR_CODES[colorName] || colorName.substring(0, 3).toUpperCase();
  const sizeCode = sizeName || 'NA';

  // Collabs use index in the category segment; other categories append index so distinct
  // products sharing the same category + color + size (e.g. two hats) do not collide.
  if (categorySlug === 'collab') {
    return `AV-${catCode}${productIndex}-${colorCode}-${sizeCode}`;
  }
  return `AV-${catCode}-${colorCode}-${sizeCode}-${productIndex}`;
}

async function seed() {
  console.log('Seeding ANTIVAXXER database...\n');

  // ===== 1. CATEGORIES =====
  console.log('Creating categories...');
  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'Tees', slug: 'tees', sortOrder: 1 } }),
    prisma.category.create({ data: { name: 'Long Sleeve', slug: 'long-sleeve', sortOrder: 2 } }),
    prisma.category.create({ data: { name: 'Crewneck', slug: 'crewneck', sortOrder: 3 } }),
    prisma.category.create({ data: { name: 'Hoodie', slug: 'hoodie', sortOrder: 4 } }),
    prisma.category.create({ data: { name: 'Hats', slug: 'hat', sortOrder: 5 } }),
    prisma.category.create({ data: { name: 'Collabs', slug: 'collab', sortOrder: 6 } }),
    prisma.category.create({ data: { name: 'Accessories', slug: 'accessories', sortOrder: 7 } }),
  ]);
  const catMap = {};
  categories.forEach((c) => (catMap[c.slug] = c));
  console.log(`  ${categories.length} categories created`);

  // ===== 2. COLORS =====
  console.log('Creating colors...');
  const colors = await Promise.all([
    prisma.color.create({ data: { name: 'Black', hexCode: '#1a1a1a', sortOrder: 1 } }),
    prisma.color.create({ data: { name: 'Pepper', hexCode: '#505050', sortOrder: 2 } }),
    prisma.color.create({ data: { name: 'Blue Jean', hexCode: '#5B7B8F', sortOrder: 3 } }),
    prisma.color.create({ data: { name: 'Grey', hexCode: '#505050', sortOrder: 4 } }),
    prisma.color.create({ data: { name: 'White', hexCode: '#FFFFFF', sortOrder: 5 } }),
    prisma.color.create({ data: { name: 'Black/Black', hexCode: '#1a1a1a', sortOrder: 6 } }),
    prisma.color.create({ data: { name: 'Red/Black', hexCode: '#6A0E0E', sortOrder: 7 } }),
    prisma.color.create({ data: { name: 'Black (Full Logo)', hexCode: '#1a1a1a', sortOrder: 8 } }),
    prisma.color.create({ data: { name: 'Charcoal', hexCode: '#505050', sortOrder: 9 } }),
    prisma.color.create({ data: { name: 'Light Blue', hexCode: '#B0C4DE', sortOrder: 10 } }),
  ]);
  const colorMap = {};
  colors.forEach((c) => (colorMap[c.name] = c));
  console.log(`  ${colors.length} colors created`);

  // ===== 3. SIZES =====
  console.log('Creating sizes...');
  const sizes = await Promise.all([
    prisma.size.create({ data: { name: 'S', sortOrder: 1 } }),
    prisma.size.create({ data: { name: 'M', sortOrder: 2 } }),
    prisma.size.create({ data: { name: 'L', sortOrder: 3 } }),
    prisma.size.create({ data: { name: 'XL', sortOrder: 4 } }),
    prisma.size.create({ data: { name: '2XL', sortOrder: 5 } }),
    prisma.size.create({ data: { name: '3XL', sortOrder: 6 } }),
    prisma.size.create({ data: { name: 'OS', sortOrder: 7 } }),
  ]);
  const sizeMap = {};
  sizes.forEach((s) => (sizeMap[s.name] = s));
  console.log(`  ${sizes.length} sizes created`);

  // ===== 4. PRODUCTS =====
  // Product definitions mapped from v9 mock
  const productDefs = [
    {
      name: 'Classic Logo Tee — Black',
      slug: 'classic-logo-tee',
      category: 'tees',
      price: 35.0,
      badge: 'BESTSELLER',
      label: 'Comfort Colors 1717 · Heavyweight',
      desc: 'The signature ANTIVAXXER logo tee. 6.1 oz heavyweight 100% ring-spun cotton. Garment-dyed for that lived-in feel. Relaxed fit, topstitched classic width rib collar. OEKO-TEX certified.',
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      colors: ['Black', 'Pepper', 'Blue Jean'],
      weightOz: 10.0,
      sortOrder: 1,
    },
    {
      name: 'Long Sleeve Tee',
      slug: 'long-sleeve-tee',
      category: 'long-sleeve',
      price: 42.0,
      badge: 'NEW',
      label: 'Comfort Colors 6014 · Heavyweight LS',
      desc: '6.1 oz heavyweight long sleeve in 100% ring spun cotton. Garment-dyed, relaxed fit with rib cuffs and twill taped neck.',
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      colors: ['Pepper', 'Black', 'Blue Jean'],
      weightOz: 12.0,
      sortOrder: 2,
    },
    {
      name: 'Logo Crewneck Sweatshirt',
      slug: 'logo-crewneck-sweatshirt',
      category: 'crewneck',
      price: 58.0,
      badge: null,
      label: 'Comfort Colors 1566 · 9.5oz Fleece',
      desc: '9.5 oz garment-dyed crewneck. 80/20 ring-spun cotton/polyester, three-end cotton face fleece. Rolled forward shoulder, 1x1 rib collar.',
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      colors: ['Grey', 'Pepper', 'Blue Jean'],
      weightOz: 16.0,
      sortOrder: 3,
    },
    {
      name: 'Logo Hoodie — Pepper',
      slug: 'logo-hoodie',
      category: 'hoodie',
      price: 68.0,
      badge: null,
      label: 'Comfort Colors 1567 · Garment-Dyed',
      desc: '9.5 oz garment-dyed hoodie. Jersey lined hood with color matched flat drawcord. Rolled forward shoulder, pouch pocket, 1x1 rib cuffs and waistband. OEKO-TEX Standard 100.',
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      colors: ['Pepper', 'White'],
      weightOz: 18.0,
      sortOrder: 4,
    },
    {
      name: 'Embroidered Trucker Hat — Rod & Serpent',
      slug: 'trucker-hat-rod-serpent',
      category: 'hat',
      price: 32.0,
      badge: null,
      label: 'Richardson 112 · Structured Snapback',
      desc: 'Structured six-panel mid pro Richardson 112 trucker. Embroidered Rod & Serpent logo. 60/40 cotton/polyester front, polyester mesh back. Pre-curved bill. Adjustable snapback.',
      sizes: ['OS'],
      colors: ['Black/Black', 'Red/Black', 'Black (Full Logo)'],
      weightOz: 4.0,
      sortOrder: 5,
    },
    {
      name: 'AV Trucker Hat — Deep Red',
      slug: 'av-trucker-hat-deep-red',
      category: 'hat',
      price: 32.0,
      badge: 'HOT',
      label: 'Richardson 112 · Embroidered AV Monogram',
      desc: 'The deep red AV monogram trucker. Richardson 112 structured crown with embroidered AV initials flanking the Rod of Asclepius.',
      sizes: ['OS'],
      colors: ['Red/Black'],
      weightOz: 4.0,
      sortOrder: 6,
    },
    {
      name: 'ANTIVAXXER x Carhartt Hoodie',
      slug: 'av-carhartt-hoodie',
      category: 'collab',
      price: 89.0,
      badge: 'COLLAB',
      label: 'Carhartt · Midweight Hooded Sweatshirt',
      desc: 'Embroidered ANTIVAXXER logo on premium Carhartt midweight hoodie. Features the signature Carhartt pocket label. Built for work, designed for the movement.',
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      colors: ['Black'],
      weightOz: 20.0,
      sortOrder: 7,
    },
    {
      name: 'ANTIVAXXER x Carhartt Tee',
      slug: 'av-carhartt-tee',
      category: 'collab',
      price: 45.0,
      badge: 'COLLAB',
      label: 'Carhartt Force · Relaxed Fit Pocket Tee',
      desc: 'Embroidered ANTIVAXXER text above the iconic Carhartt pocket. Force fabric with FastDry technology wicks sweat and fights odors.',
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      colors: ['Black'],
      weightOz: 10.0,
      sortOrder: 8,
    },
    {
      name: 'ANTIVAXXER x Carhartt Beanie',
      slug: 'av-carhartt-beanie',
      category: 'collab',
      price: 28.0,
      badge: 'COLLAB',
      label: 'Carhartt · Knit Cuffed Beanie',
      desc: 'Embroidered ANTIVAXXER logo on Carhartt iconic cuffed beanie. Rib knit, 100% acrylic. Carhartt label at cuff.',
      sizes: ['OS'],
      colors: ['Black'],
      weightOz: 3.0,
      sortOrder: 9,
    },
    {
      name: 'ANTIVAXXER x Columbia PFG Shirt',
      slug: 'av-columbia-pfg-shirt',
      category: 'collab',
      price: 72.0,
      badge: 'COLLAB',
      label: 'Columbia PFG · Bahama II SS Shirt',
      desc: 'Embroidered ANTIVAXXER on Columbia legendary PFG fishing shirt. Omni-Shade UPF 50 protection, vented back, rod holder.',
      sizes: ['S', 'M', 'L', 'XL', '2XL'],
      colors: ['Black'],
      weightOz: 8.0,
      sortOrder: 10,
    },
    {
      name: 'ANTIVAXXER x Columbia Polo',
      slug: 'av-columbia-polo',
      category: 'collab',
      price: 65.0,
      badge: 'COLLAB',
      label: 'Columbia · PFG Perfect Cast Polo',
      desc: 'Embroidered ANTIVAXXER on Columbia performance polo. Omni-Wick moisture management, Omni-Shade UPF 30. Dress code compliant rebellion.',
      sizes: ['S', 'M', 'L', 'XL', '2XL'],
      colors: ['Black'],
      weightOz: 8.0,
      sortOrder: 11,
    },
    {
      name: 'ANTIVAXXER x Columbia Fleece Vest',
      slug: 'av-columbia-fleece-vest',
      category: 'collab',
      price: 68.0,
      badge: 'COLLAB',
      label: 'Columbia · Steens Mountain Vest',
      desc: 'Embroidered ANTIVAXXER on Columbia Steens Mountain fleece vest. MTR filament fleece, zippered hand pockets. Layer up your convictions.',
      sizes: ['S', 'M', 'L', 'XL', '2XL'],
      colors: ['Charcoal'],
      weightOz: 14.0,
      sortOrder: 12,
    },
    {
      name: 'ANTIVAXXER x Columbia LS',
      slug: 'av-columbia-ls',
      category: 'collab',
      price: 58.0,
      badge: 'COLLAB',
      label: 'Columbia PFG · Terminal Tackle LS',
      desc: 'Large ANTIVAXXER logo and PFG branding on Columbia performance long sleeve. Omni-Wick, Omni-Shade UPF 50.',
      sizes: ['S', 'M', 'L', 'XL', '2XL'],
      colors: ['Black'],
      weightOz: 10.0,
      sortOrder: 13,
    },
    {
      name: 'ANTIVAXXER x Vineyard Vines Quarter Zip',
      slug: 'av-vineyard-vines-quarter-zip',
      category: 'collab',
      price: 95.0,
      badge: 'COLLAB',
      label: 'Vineyard Vines · Shep Shirt',
      desc: 'Rod & Serpent embroidery on the classic Vineyard Vines Shep Shirt. 100% cotton jersey, brushed interior, signature whale label. Country club rebellion.',
      sizes: ['S', 'M', 'L', 'XL', '2XL'],
      colors: ['Black'],
      weightOz: 16.0,
      sortOrder: 14,
    },
    {
      name: 'ANTIVAXXER x Vineyard Vines Polo',
      slug: 'av-vineyard-vines-polo',
      category: 'collab',
      price: 78.0,
      badge: 'COLLAB',
      label: 'Vineyard Vines · Stretch Pique Polo',
      desc: 'Embroidered ANTIVAXXER logo on Vineyard Vines stretch pique polo. Signature whale at sleeve. The classiest way to question the narrative.',
      sizes: ['S', 'M', 'L', 'XL', '2XL'],
      colors: ['Light Blue'],
      weightOz: 8.0,
      sortOrder: 15,
    },
    {
      name: 'ANTIVAXXER x Vineyard Vines Tote',
      slug: 'av-vineyard-vines-tote',
      category: 'collab',
      price: 55.0,
      badge: 'COLLAB',
      label: 'Vineyard Vines · Classic Tote Bag',
      desc: 'Embroidered ANTIVAXXER logo on Vineyard Vines heavyweight canvas tote. Black trim, interior pocket. Naturally immune to propaganda, stylishly carried.',
      sizes: [],
      colors: [],
      weightOz: 12.0,
      sortOrder: 16,
    },
  ];

  // Default stock quantities by size (placeholder for launch)
  const defaultStock = { S: 15, M: 25, L: 30, XL: 20, '2XL': 12, '3XL': 8, OS: 50 };

  console.log('\nCreating products, variants, and associations...');

  let totalVariants = 0;

  for (let i = 0; i < productDefs.length; i++) {
    const def = productDefs[i];
    const category = catMap[def.category];

    // Create product
    const product = await prisma.product.create({
      data: {
        name: def.name,
        slug: def.slug,
        categoryId: category.id,
        basePrice: def.price,
        description: def.desc,
        variantLabel: def.label,
        badge: def.badge,
        sortOrder: def.sortOrder,
        featured: def.badge === 'BESTSELLER',
      },
    });

    // Create product-color associations
    for (const colorName of def.colors) {
      const color = colorMap[colorName];
      if (color) {
        await prisma.productColor.create({
          data: { productId: product.id, colorId: color.id },
        });
      }
    }

    // Create product-size associations
    for (const sizeName of def.sizes) {
      const size = sizeMap[sizeName];
      if (size) {
        await prisma.productSize.create({
          data: { productId: product.id, sizeId: size.id },
        });
      }
    }

    // Create variants (SKUs) — one per color x size combo
    if (def.colors.length > 0 && def.sizes.length > 0) {
      for (const colorName of def.colors) {
        for (const sizeName of def.sizes) {
          const color = colorMap[colorName];
          const size = sizeMap[sizeName];
          if (color && size) {
            const sku = generateSku(def.category, colorName, sizeName, i + 1);
            await prisma.variant.create({
              data: {
                productId: product.id,
                colorId: color.id,
                sizeId: size.id,
                sku,
                stockQty: defaultStock[sizeName] || 10,
                weightOz: def.weightOz,
              },
            });
            totalVariants++;
          }
        }
      }
    } else if (def.colors.length === 0 && def.sizes.length === 0) {
      // No color or size (e.g., tote bag) — single variant
      const sku = generateSku(def.category, 'DEFAULT', 'NA', i + 1);
      await prisma.variant.create({
        data: {
          productId: product.id,
          sku,
          stockQty: 30,
          weightOz: def.weightOz,
        },
      });
      totalVariants++;
    }

    console.log(
      `  ${product.name} — ${def.colors.length || 1} color(s) x ${def.sizes.length || 1} size(s)`
    );
  }

  console.log(`\n===== SEED COMPLETE =====`);
  console.log(`  Categories: ${categories.length}`);
  console.log(`  Colors:     ${colors.length}`);
  console.log(`  Sizes:      ${sizes.length}`);
  console.log(`  Products:   ${productDefs.length}`);
  console.log(`  Variants:   ${totalVariants} SKUs`);
}

seed()
  .then(() => {
    console.log('\nDatabase seeded successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nSeed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
