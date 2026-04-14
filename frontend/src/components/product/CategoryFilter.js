/**
 * CategoryFilter Component — ANTIVAXXER
 *
 * [AV-005] feat: product grid with API integration
 *
 * Horizontal filter tabs: ALL, TEES, LONG SLEEVE, etc.
 * Clicking a tab filters the product grid by category.
 *
 * ADA: role="tablist" with aria-selected per tab.
 */

'use client';

export default function CategoryFilter({ categories, activeCategory, onFilter }) {
  return (
    <div
      role="tablist"
      aria-label="Filter products by category"
      className="flex flex-wrap gap-2 justify-center mb-10"
    >
      {/* ALL tab */}
      <button
        role="tab"
        aria-selected={activeCategory === null}
        onClick={() => onFilter(null)}
        className={`
          px-5 py-2 text-[10px] tracking-widest uppercase transition-all duration-200
          ${activeCategory === null
            ? 'bg-av-bone text-av-black'
            : 'border border-av-bone-dim text-av-bone-muted hover:border-av-bone hover:text-av-bone'
          }
        `}
      >
        All
      </button>

      {/* Category tabs */}
      {categories.map((cat) => (
        <button
          key={cat.slug}
          role="tab"
          aria-selected={activeCategory === cat.slug}
          onClick={() => onFilter(cat.slug)}
          className={`
            px-5 py-2 text-[10px] tracking-widest uppercase transition-all duration-200
            ${activeCategory === cat.slug
              ? 'bg-av-bone text-av-black'
              : 'border border-av-bone-dim text-av-bone-muted hover:border-av-bone hover:text-av-bone'
            }
          `}
        >
          {cat.name}
          {cat.productCount !== undefined && (
            <span className="ml-1.5 text-[8px] opacity-50">
              ({cat.productCount})
            </span>
          )}
        </button>
      ))}
    </div>
  );
}
