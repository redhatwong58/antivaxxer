# v5.3.4 — Medical Liberty Map + Quick Add on all products

**Release:**
**Tracking:** [AV-047] resources page, [AV-048] product card quick add

## Changes

### Resources page — US Medical Liberty Map takeover
- `frontend/public/us-map.html` — replaced placeholder with full D3 interactive map.
- `frontend/src/app/resources/page.js` — simplified. Map is now the primary
  content of the page. Categorized NATIONAL/RESEARCH lists removed (map
  sidebar handles directory).

#### Map details
- **50 states only** — DC removed from `fipsToAbbr` and `orgData`. The map
  renders exactly 50 state shapes.
- **Header**: "United States Medical Liberty Map" / "Proceeds go to support
  these organizations"
- **Bottom legend removed** — the "Has organizations / No organizations /
  3+ organizations" key block is gone. Red pulse dot markers on states
  with orgs are preserved.
- **State → org data** rewritten from `State_Groups_with_links.docx` as
  source of truth. 41 states have entries:
    AL, AZ, CA, CO, CT, FL, GA, ID, IL, IN, IA, KS, KY, LA, MD, MA, MI,
    MN, MS, MO, MT, NV, NH, NJ, NC, ND, OH, OK, OR, PA, SC, SD, TN, TX,
    UT, VT, VA, WA, WV, WI, WY.
  States without orgs in the doc (previously had fabricated entries) are
  now empty gray: AK, AR, DE, HI, ME, NE, NM, NY, RI.
- **National ribbon**:
    - Label: "National Resources" → "National"
    - **ICAN added as first entry, featured/bolded** (new `.nr-link.featured`
      class: heavier weight, brighter text, red left border)
    - Existing: Stand for Health Freedom, Children's Health Defense,
      Health Freedom Defense Fund
- **Hover outline fix**: added `d3.select(this).raise()` in the state
  `mouseenter` handler, plus in `selectState()`. Previously, when states
  like AL, NJ, NC, IN, MO, MN, KS, CO, WY, AZ, WV, DE, OR were hovered,
  neighboring state paths drawn after them in the DOM visually clipped
  parts of the hover outline. Raising the hovered path to the top of the
  SVG draw order ensures the full border is always visible. Hover/active
  stroke widths were also bumped from 1/1.2 to 1.5/2.5 so the highlight
  reads more clearly, and `vector-effect: non-scaling-stroke` was added
  for stable stroke rendering across zoom levels.

### Product card — Quick Add for all products, all devices
- `frontend/src/components/product/ProductCard.js` restructured.
- Quick Add button is now **inside the image frame** at `bottom: 0` instead
  of floating at a magic `bottom: 72px` offset outside the image.
- **Desktop** (hover-capable): translated off-screen, slides up on
  `group:hover` — same reveal animation as before.
- **Mobile / touch**: `@media (hover: none), (pointer: coarse)` forces
  the button to always be visible and tappable. The previous version was
  hover-only, so mobile users could never reach it.
- Click-through to `/shop/[slug]` still works — the `<Link>` wraps
  image + info, Quick Add is inside with `e.preventDefault()` +
  `e.stopPropagation()`.
- No changes needed in homepage (`app/page.js`) or `ProductGrid.js` — they
  already pass `onSelectProduct` → `onQuickView` to every card.

## Files changed
- `frontend/public/us-map.html` (rewritten)
- `frontend/src/app/resources/page.js` (simplified)
- `frontend/src/components/product/ProductCard.js` (quick add restructured)

## Rollback
```bash
cp _rollback/v5.3.3/public/us-map.html frontend/public/us-map.html
cp _rollback/v5.3.3/app/resources/page.js frontend/src/app/resources/page.js
cp _rollback/v5.3.3/components/product/ProductCard.js frontend/src/components/product/ProductCard.js
```

## Validation
- Map JS: `new Function()` parse OK
- ProductCard JSX: `@babel/parser` parse OK
- Resources page JSX: `@babel/parser` parse OK
- Map content checks: 50 states in fipsToAbbr, no DC, no map-legend HTML,
  41 states in orgData, ICAN featured link present, `raise()` present,
  title/subtitle updated.
