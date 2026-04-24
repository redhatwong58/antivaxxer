/**
 * ANTIVAXXER — Database Seed Script
 *
 * [AV-045] v5.3.2: Full replacement with 12 real products from launch inventory.
 *
 * Replaces the 16 fake v9-mock products (Carhartt/Columbia/Vineyard Vines collabs
 * that never existed) with the actual launch inventory from Antivaxxer_Products.pdf:
 *   - 2 Comfort Colors tees (Classic + Definition)
 *   - 2 Independent Trading Co hoodies (Regular + Camo)
 *   - 1 Richardson trucker hat
 *   - 1 Peter Millar performance polo
 *   - 1 Nike Legend long sleeve
 *   - 1 Nike Pro hooded jacket
 *   - 1 Johnnie-O Remmy performance hoodie tee
 *   - 1 Blender Bottle
 *   - 1 Yeti tumbler
 *   - 1 Non-branded stainless tumbler
 *
 * Images: mapped from /public/images/products/ (dropped in v5.3.2).
 * Prices: MSRP from PDF.
 * Size breakdowns: from PDF.
 *
 * ============================================================================
 * TODO [SUPPLIER COPY] — REPLACE DESCRIPTIONS WHEN YOU HAVE SUPPLIER ACCESS
 * ============================================================================
 * Each product below has a `desc` field written in ANTIVAXXER's voice using
 * only the factual specs from the PDF (brand, fabric weight, fit type, etc.).
 *
 * When you get direct access to supplier product feeds (SanMar, SS Activewear,
 * drivingi, etc.), replace each `desc` string with the official manufacturer
 * description. Search this file for "[SUPPLIER COPY]" to find every product
 * that needs swapping.
 *
 * Recommended approach:
 *   1. Get supplier API access OR copy descriptions manually from supplier portal
 *   2. Keep ANTIVAXXER-voice intro line, append manufacturer specs
 *   3. Re-run `npm run db:seed` in a staging environment first
 *   4. Test one product at a time before bulk update
 *
 * URLs for reference (as of launch):
 *   Comfort Colors Tee     → https://www.sanmar.com/p/9671_BurntOrng
 *   ITC Hoodie SS4500      → https://www.ssactivewear.com/p/independent_trading_co/ss4500
 *   Richardson 112 Hat     → https://www.sanmar.com/p/72574_OrgWhBlk
 *   Peter Millar Polo      → https://drivingi.com/peter-millar-men-s-solid-performance-polo-self-collar.html
 *   Nike Long Sleeve 60384 → https://www.sanmar.com/p/60384_Black
 *   Nike Pro Jacket 49073  → https://www.sanmar.com/p/49073_NvGmRoyal
 *   Johnnie-O Remmy        → https://drivingi.com/johnnie-o-men-s-remmy-hoodie.html
 *   Yeti Tumbler           → https://www.thirstyboxer.com/product/YETI-Rambler-10-Oz-Tumbler-With-MagSlider-Lid/R10MST
 * ============================================================================
 *
 * Run: cd api && npm run db:seed
 * Requires: DATABASE_URL set in .env, migrations already run
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ===== SKU GENERATION =====
// Format: AV-{CATEGORY_CODE}{PRODUCT_IDX}-{COLOR_CODE}-{SIZE}
const SKU_CATEGORY_CODES = {
  tees: 'TEE',
  'long-sleeve': 'LS',
  hoodie: 'HOOD',
  polo: 'POLO',
  outerwear: 'OUT',
  hat: 'HAT',
  accessories: 'ACC',
};

const SKU_COLOR_CODES = {
  Black: 'BLK',
  White: 'WHT',
  Grey: 'GRY',
  Sand: 'SND',
  'Black Camo': 'BCM',
  'Black/Charcoal': 'BC',
  'Cottage Blue': 'CBL',
  'Navy/Game Royal': 'NGR',
  'Dark Grey': 'DGY',
  Stainless: 'SST',
};

function generateSku(categorySlug, colorName, sizeName, productIndex) {
  const catCode = SKU_CATEGORY_CODES[categorySlug] || 'GEN';
  const colorCode = SKU_COLOR_CODES[colorName] || colorName.substring(0, 3).toUpperCase();
  const sizeCode = sizeName || 'NA';
  return `AV-${catCode}${productIndex}-${colorCode}-${sizeCode}`;
}

async function seed() {
  console.log('Seeding ANTIVAXXER database (v5.3.2 — real inventory)...\n');

  // ===== CLEAN SLATE =====
  // Order matters: child records first, then parents (respects FKs)
  console.log('Clearing existing data...');
  await prisma.wishlist.deleteMany({});
  await prisma.productImage.deleteMany({});
  await prisma.variant.deleteMany({});
  await prisma.productColor.deleteMany({});
  await prisma.productSize.deleteMany({});
  await prisma.product.deleteMany({});
  await prisma.color.deleteMany({});
  await prisma.size.deleteMany({});
  await prisma.category.deleteMany({});
  console.log('  Cleared.\n');

  // ===== 1. CATEGORIES =====
  console.log('Creating categories...');
  const categories = await Promise.all([
    prisma.category.create({ data: { name: 'Tees', slug: 'tees', sortOrder: 1 } }),
    prisma.category.create({ data: { name: 'Long Sleeve', slug: 'long-sleeve', sortOrder: 2 } }),
    prisma.category.create({ data: { name: 'Hoodies', slug: 'hoodie', sortOrder: 3 } }),
    prisma.category.create({ data: { name: 'Polos', slug: 'polo', sortOrder: 4 } }),
    prisma.category.create({ data: { name: 'Outerwear', slug: 'outerwear', sortOrder: 5 } }),
    prisma.category.create({ data: { name: 'Hats', slug: 'hat', sortOrder: 6 } }),
    prisma.category.create({ data: { name: 'Accessories', slug: 'accessories', sortOrder: 7 } }),
  ]);
  const catMap = {};
  categories.forEach((c) => (catMap[c.slug] = c));
  console.log(`  ${categories.length} categories created`);

  // ===== 2. COLORS =====
  console.log('Creating colors...');
  const colors = await Promise.all([
    prisma.color.create({ data: { name: 'Black', hexCode: '#1a1a1a', sortOrder: 1 } }),
    prisma.color.create({ data: { name: 'White', hexCode: '#FFFFFF', sortOrder: 2 } }),
    prisma.color.create({ data: { name: 'Grey', hexCode: '#8A8A8A', sortOrder: 3 } }),
    prisma.color.create({ data: { name: 'Sand', hexCode: '#C4B895', sortOrder: 4 } }),
    prisma.color.create({ data: { name: 'Black Camo', hexCode: '#3B3D36', sortOrder: 5 } }),
    prisma.color.create({ data: { name: 'Black/Charcoal', hexCode: '#1a1a1a', sortOrder: 6 } }),
    prisma.color.create({ data: { name: 'Cottage Blue', hexCode: '#A8C8E0', sortOrder: 7 } }),
    prisma.color.create({ data: { name: 'Navy/Game Royal', hexCode: '#1a2947', sortOrder: 8 } }),
    prisma.color.create({ data: { name: 'Dark Grey', hexCode: '#3A3A3A', sortOrder: 9 } }),
    prisma.color.create({ data: { name: 'Stainless', hexCode: '#C0C0C0', sortOrder: 10 } }),
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
  // 12 real products from Antivaxxer_Products.pdf
  //
  // [SUPPLIER COPY] search tag — each `desc` is ANTIVAXXER-voice placeholder.
  // Replace with official manufacturer descriptions when supplier access is available.
  const productDefs = [
    // ---------- TEE 1: Comfort Colors Classic (Front Only) ----------
    {
      name: 'Classic Tee — Front Logo',
      slug: 'classic-tee',
      category: 'tees',
      price: 32.0,
      badge: 'BESTSELLER',
      label: 'Comfort Colors · Heavyweight Ring-Spun',
      // [SUPPLIER COPY] — Comfort Colors 1717, replace with SanMar description
      desc: 'The foundation of the collection. Garment-dyed heavyweight ring-spun cotton by Comfort Colors, printed with the signature ANTIVAXXER front logo. Soft from the first wear, relaxed fit, and built to live in. No slogans, no noise — just the word, reclaimed.',
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      stockBySize: { S: 15, M: 25, L: 30, XL: 20, '2XL': 8, '3XL': 2 },
      colors: ['White', 'Black', 'Grey'],
      weightOz: 10.0,
      sortOrder: 1,
      featured: true,
      images: [
        { url: '/images/products/tee-front-black.jpg', color: 'Black', isPrimary: true },
        { url: '/images/products/tee-front-white.jpg', color: 'White' },
        { url: '/images/products/tee-front-grey.jpg', color: 'Grey' },
      ],
    },

    // ---------- TEE 2: Comfort Colors Definition Tee (Front + Back) ----------
    {
      name: 'Definition Tee — Front & Back',
      slug: 'definition-tee',
      category: 'tees',
      price: 38.0,
      badge: 'FEATURED',
      label: 'Comfort Colors · Heavyweight Ring-Spun',
      // [SUPPLIER COPY] — Comfort Colors 1717, replace with SanMar description
      desc: 'The statement piece. Same heavyweight Comfort Colors build as the Classic Tee, with the dictionary definition printed on the back: "antivaxxer [noun] — A person who thinks and questions. A word reclaimed." Front logo keeps it subtle until someone asks what it means. That is the whole point.',
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      stockBySize: { S: 12, M: 22, L: 28, XL: 20, '2XL': 6, '3XL': 2 },
      colors: ['Black', 'White', 'Grey'],
      weightOz: 10.0,
      sortOrder: 2,
      featured: true,
      images: [
        { url: '/images/products/definition-tee-noun-black.jpg', color: 'Black', isPrimary: true },
      ],
    },

    // ---------- HOODIE 1: Independent Trading Co Camo ----------
    {
      name: 'Camo Hoodie',
      slug: 'camo-hoodie',
      category: 'hoodie',
      price: 60.0,
      badge: 'NEW',
      label: 'Independent Trading Co · Midweight Fleece',
      // [SUPPLIER COPY] — ITC SS4500, replace with SS Activewear description
      desc: 'Independent Trading Company midweight fleece hoodie in forest camo. Front ANTIVAXXER logo print. Pouch pocket, drawcord hood, ribbed cuffs and hem. Built for layering, built to last. For the thinkers who prefer to blend in until they do not.',
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      stockBySize: { S: 5, M: 10, L: 12, XL: 10, '2XL': 6, '3XL': 2 },
      colors: ['Black Camo'],
      weightOz: 24.0,
      sortOrder: 3,
      images: [
        { url: '/images/products/itc-camo-hoodie.jpg', color: 'Black Camo', isPrimary: true },
      ],
    },

    // ---------- HOODIE 2: Independent Trading Co Regular ----------
    {
      name: 'Signature Hoodie',
      slug: 'signature-hoodie',
      category: 'hoodie',
      price: 68.0,
      badge: null,
      label: 'Independent Trading Co · Midweight Fleece',
      // [SUPPLIER COPY] — ITC SS4500, replace with SS Activewear description
      desc: 'The everyday hoodie. Independent Trading Company midweight fleece in three colorways — white, black, and grey. Front ANTIVAXXER logo in contrast thread. Pouch pocket, double-needle stitching, jersey-lined hood. Premium construction that earns its place in rotation.',
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      stockBySize: { S: 5, M: 10, L: 15, XL: 15, '2XL': 8, '3XL': 2 },
      colors: ['White', 'Black', 'Grey'],
      weightOz: 24.0,
      sortOrder: 4,
      images: [
        { url: '/images/products/itc-hoodie-trio.jpg', isPrimary: true },
      ],
    },

    // ---------- HAT: Richardson 112 Trucker ----------
    {
      name: 'Trucker Hat',
      slug: 'trucker-hat',
      category: 'hat',
      price: 35.0,
      badge: 'LIMITED',
      label: 'Richardson 112 · Structured Snapback',
      // [SUPPLIER COPY] — Richardson 112, replace with SanMar description
      desc: 'Richardson 112 structured snapback — the industry standard for a reason. Embroidered Rod of Asclepius front center. "antivaxxer.com" embroidered in an arc across the back mesh. 150 units total for launch. Black crown, charcoal mesh, pre-curved bill.',
      sizes: ['OS'],
      stockBySize: { OS: 150 },
      colors: ['Black/Charcoal'],
      weightOz: 4.0,
      sortOrder: 5,
      images: [
        { url: '/images/products/trucker-hat-richardson.jpg', color: 'Black/Charcoal', isPrimary: true },
      ],
    },

    // ---------- POLO: Peter Millar ----------
    {
      name: 'Performance Polo',
      slug: 'performance-polo',
      category: 'polo',
      price: 165.0,
      badge: 'PREMIUM',
      label: 'Peter Millar · Solid Performance with Self Collar',
      // [SUPPLIER COPY] — Peter Millar, replace with drivingi.com description
      desc: 'Peter Millar Solid Performance Polo with self collar. Moisture-wicking stretch fabric, UPF 50+ sun protection, four-way stretch for unrestricted movement. Embroidered ANTIVAXXER logo at left chest. The polo for boardrooms, clubhouses, and any room where conversation matters.',
      sizes: ['M', 'L', 'XL', '2XL'],
      stockBySize: { M: 8, L: 12, XL: 10, '2XL': 5 },
      colors: ['Cottage Blue'],
      weightOz: 8.0,
      sortOrder: 6,
      images: [
        { url: '/images/products/peter-millar-polo.jpg', color: 'Cottage Blue', isPrimary: true },
      ],
    },

    // ---------- LONG SLEEVE: Nike Legend ----------
    {
      name: 'Nike Legend Long Sleeve',
      slug: 'nike-long-sleeve',
      category: 'long-sleeve',
      price: 65.0,
      badge: null,
      label: 'Nike · Legend Dri-FIT Long Sleeve',
      // [SUPPLIER COPY] — Nike Legend 60384, replace with SanMar description
      desc: 'Nike Legend long sleeve performance tee. Dri-FIT moisture management, ribbed crew neck, modern athletic fit. Front-printed ANTIVAXXER logo with Nike swoosh at chest. Built for training, designed for thinking.',
      sizes: ['S', 'M', 'L', 'XL', '2XL', '3XL'],
      stockBySize: { S: 8, M: 12, L: 15, XL: 12, '2XL': 8, '3XL': 5 },
      colors: ['Black'],
      weightOz: 8.0,
      sortOrder: 7,
      images: [
        { url: '/images/products/nike-long-sleeve.jpg', color: 'Black', isPrimary: true },
      ],
    },

    // ---------- OUTERWEAR: Nike Pro Hooded Jacket ----------
    {
      name: 'Nike Pro Hooded Jacket',
      slug: 'nike-hooded-jacket',
      category: 'outerwear',
      price: 145.0,
      badge: 'PREMIUM',
      label: 'Nike · Pro Hooded Full-Zip',
      // [SUPPLIER COPY] — Nike 49073, replace with SanMar description
      desc: 'Nike Pro hooded full-zip jacket. Water-resistant outer shell, zippered hand pockets, adjustable drawcord hood. Printed ANTIVAXXER logo at left chest, Nike swoosh at opposite. Layer it for training, wear it everywhere else.',
      sizes: ['M', 'L', 'XL', '2XL'],
      stockBySize: { M: 6, L: 10, XL: 10, '2XL': 6 },
      colors: ['Navy/Game Royal'],
      weightOz: 18.0,
      sortOrder: 8,
      images: [
        { url: '/images/products/nike-hooded-jacket.jpg', color: 'Navy/Game Royal', isPrimary: true },
      ],
    },

    // ---------- HOODIE 3: Johnnie-O Remmy ----------
    {
      name: 'Remmy Performance Hoodie',
      slug: 'remmy-performance-hoodie',
      category: 'hoodie',
      price: 170.0,
      badge: 'PREMIUM',
      label: 'Johnnie-O · Remmy Performance Hoodie',
      // [SUPPLIER COPY] — Johnnie-O Remmy, replace with drivingi.com description
      desc: 'Johnnie-O Remmy performance hoodie — the lightest, softest premium hoodie in the lineup. Moisture-wicking blend, button-down hood, relaxed tailored fit. Printed ANTIVAXXER logo front center. For country-club-meets-conviction energy. Premium quality, unmistakable statement.',
      sizes: ['M', 'L', 'XL', '2XL'],
      stockBySize: { M: 6, L: 10, XL: 10, '2XL': 6 },
      colors: ['Dark Grey'],
      weightOz: 14.0,
      sortOrder: 9,
      images: [
        { url: '/images/products/johnnie-o-remmy.jpg', color: 'Dark Grey', isPrimary: true },
      ],
    },

    // ---------- ACCESSORY 1: Blender Bottle ----------
    {
      name: 'Shaker Bottle',
      slug: 'shaker-bottle',
      category: 'accessories',
      price: 18.0,
      badge: null,
      label: 'Classic 28oz Shaker with Wire Whisk',
      // [SUPPLIER COPY] — Non-branded, write final description when ready
      desc: '28oz shaker bottle with leak-proof flip cap and stainless steel wire whisk ball. Printed ANTIVAXXER logo in bone white. BPA-free, dishwasher-safe, built for the gym bag. The bottle you throw in your gym bag and do not think about — except when someone asks about the logo.',
      sizes: ['OS'],
      stockBySize: { OS: 150 },
      colors: ['Black'],
      weightOz: 6.0,
      sortOrder: 10,
      images: [
        { url: '/images/products/blender-bottle.jpg', color: 'Black', isPrimary: true },
      ],
    },

    // ---------- ACCESSORY 2: Yeti Tumbler ----------
    {
      name: 'Yeti Rambler Tumbler',
      slug: 'yeti-tumbler',
      category: 'accessories',
      price: 65.0,
      badge: 'LIMITED',
      label: 'Yeti · 20oz Rambler with MagSlider Lid',
      // [SUPPLIER COPY] — Yeti Rambler, replace with thirstyboxer.com description
      desc: 'Yeti Rambler 20oz tumbler with MagSlider lid. Double-wall vacuum insulation keeps cold drinks cold and hot drinks hot. Laser-engraved ANTIVAXXER logo in matte finish — will not chip, will not fade, will not come off. 50 units total for launch.',
      sizes: ['OS'],
      stockBySize: { OS: 50 },
      colors: ['Black'],
      weightOz: 14.0,
      sortOrder: 11,
      images: [
        { url: '/images/products/yeti-tumbler.jpg', color: 'Black', isPrimary: true },
      ],
    },

    // ---------- ACCESSORY 3: Non-Branded Stainless Tumbler ----------
    {
      name: 'Stainless Steel Tumbler',
      slug: 'stainless-tumbler',
      category: 'accessories',
      price: 35.0,
      badge: null,
      label: '20oz Double-Wall Insulated',
      // [SUPPLIER COPY] — Non-branded, write final description when ready
      desc: '20oz stainless steel tumbler with double-wall vacuum insulation. Laser-engraved ANTIVAXXER logo. Brushed steel finish, sliding lid, fits standard cup holders. Premium quality at an accessible price.',
      sizes: ['OS'],
      stockBySize: { OS: 100 },
      colors: ['Stainless'],
      weightOz: 12.0,
      sortOrder: 12,
      images: [
        { url: '/images/products/stainless-tumbler.jpg', color: 'Stainless', isPrimary: true },
      ],
    },
  ];

  console.log('\nCreating products, variants, images, and associations...');

  let totalVariants = 0;
  let totalImages = 0;

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
        featured: def.featured === true,
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

    // Create variants (SKUs) — one per color x size combo, with real stock from PDF
    if (def.colors.length > 0 && def.sizes.length > 0) {
      for (const colorName of def.colors) {
        for (const sizeName of def.sizes) {
          const color = colorMap[colorName];
          const size = sizeMap[sizeName];
          if (color && size) {
            const sku = generateSku(def.category, colorName, sizeName, i + 1);
            const stockForSize = def.stockBySize[sizeName] || 10;
            await prisma.variant.create({
              data: {
                productId: product.id,
                colorId: color.id,
                sizeId: size.id,
                sku,
                stockQty: stockForSize,
                weightOz: def.weightOz,
              },
            });
            totalVariants++;
          }
        }
      }
    }

    // Create product images — map color names to color records if specified
    if (def.images && def.images.length > 0) {
      for (let imgIdx = 0; imgIdx < def.images.length; imgIdx++) {
        const img = def.images[imgIdx];
        const color = img.color ? colorMap[img.color] : null;
        await prisma.productImage.create({
          data: {
            productId: product.id,
            colorId: color?.id || null,
            url: img.url,
            altText: `${def.name}${img.color ? ` — ${img.color}` : ''}`,
            sortOrder: imgIdx,
            isPrimary: img.isPrimary === true,
          },
        });
        totalImages++;
      }
    }

    console.log(
      `  ${product.name} — ${def.colors.length || 1} color(s) × ${def.sizes.length || 1} size(s) · $${def.price}`
    );
  }

  console.log(`\n===== SEED COMPLETE =====`);
  console.log(`  Categories: ${categories.length}`);
  console.log(`  Colors:     ${colors.length}`);
  console.log(`  Sizes:      ${sizes.length}`);
  console.log(`  Products:   ${productDefs.length}`);
  console.log(`  Variants:   ${totalVariants} SKUs`);
  console.log(`  Images:     ${totalImages}`);
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
