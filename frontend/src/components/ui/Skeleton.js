/**
 * Skeleton Loading Component — ANTIVAXXER
 *
 * [AV-005] feat: product grid with API integration
 *
 * Shimmer placeholder shown while data loads.
 * Per Error Handling Standards: loading states on every data fetch,
 * never a blank page.
 *
 * ADA: aria-hidden since decorative, screen readers skip it.
 */

export function Skeleton({ className = '', ...props }) {
  return (
    <div
      aria-hidden="true"
      className={`animate-pulse bg-av-bone-dim rounded ${className}`}
      {...props}
    />
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="group" aria-hidden="true">
      <Skeleton className="aspect-square w-full rounded-none" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-1/4" />
      </div>
    </div>
  );
}

export function ProductGridSkeleton({ count = 8 }) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}
