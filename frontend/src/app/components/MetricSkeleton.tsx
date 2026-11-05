import { BentoCard } from "./BentoCard";

interface MetricSkeletonProps {
  variant?: "light" | "sand" | "dark" | "brown";
  showFreshness?: boolean;
}

/**
 * Skeleton loader for MetricCard component.
 * Matches the Bento design system with shimmer animation.
 * Use during loading state for metric data.
 */
export function MetricSkeleton({
  variant = "sand",
  showFreshness = false,
}: MetricSkeletonProps) {
  return (
    <BentoCard variant={variant} className="flex flex-col gap-4">
      {/* Header: Title and Icon */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="h-6 w-32 rounded-full animate-pulse bg-black/10 mb-2" />
          <div className="h-4 w-24 rounded-full animate-pulse bg-black/10 opacity-60" />
        </div>
        <div className="w-12 h-12 rounded-[var(--radius)] animate-pulse bg-black/10" />
      </div>

      {/* Value and Unit */}
      <div className="flex items-baseline gap-2">
        <div className="h-12 w-24 rounded-full animate-pulse bg-black/10" />
        <div className="h-7 w-16 rounded-full animate-pulse bg-black/10 opacity-60" />
      </div>

      {/* Optional Freshness Indicator */}
      {showFreshness && (
        <div className="h-4 w-40 rounded-full animate-pulse bg-black/10 opacity-50" />
      )}
    </BentoCard>
  );
}

/**
 * Grid of metric skeletons for dashboard loading.
 * Useful for Bento grid layouts with mixed metric sizes.
 */
export function MetricSkeletonGrid({
  count = 3,
  variant = "sand",
}: {
  count?: number;
  variant?: "light" | "sand" | "dark" | "brown";
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <MetricSkeleton key={i} variant={variant} showFreshness={i === 0} />
      ))}
    </div>
  );
}
