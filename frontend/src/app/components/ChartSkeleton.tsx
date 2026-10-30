import { BentoCard } from "./BentoCard";

interface ChartSkeletonProps {
  variant?: "light" | "sand" | "dark" | "brown";
  title?: boolean;
  height?: "sm" | "md" | "lg";
}

/**
 * Skeleton loader for chart components.
 * Matches the Bento design system with shimmer animation.
 * Use during data fetching for historical charts.
 */
export function ChartSkeleton({
  variant = "light",
  title = true,
  height = "md",
}: ChartSkeletonProps) {
  const heightClass = {
    sm: "h-48",
    md: "h-80",
    lg: "h-[500px]",
  }[height];

  return (
    <BentoCard variant={variant} className="flex flex-col gap-4">
      <span role="status" className="sr-only">Cargando gráfica</span>
      {/* Title */}
      {title && (
        <>
          <div className="h-6 w-40 rounded-full animate-shimmer" />
          <div className="h-4 w-56 rounded-full animate-shimmer opacity-60" />
        </>
      )}

      {/* Chart placeholder */}
      <div className={`${heightClass} rounded-[24px] animate-shimmer`} />

      {/* Legend/Controls */}
      <div className="flex gap-3 mt-2">
        <div className="h-4 w-20 rounded-full animate-shimmer" />
        <div className="h-4 w-20 rounded-full animate-shimmer" />
        <div className="h-4 w-20 rounded-full animate-shimmer" />
      </div>
    </BentoCard>
  );
}

/**
 * Multiple chart skeletons for composite dashboard views.
 */
export function ChartSkeletonGrid({
  count = 2,
  variant = "light",
}: {
  count?: number;
  variant?: "light" | "sand" | "dark" | "brown";
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {Array.from({ length: count }).map((_, i) => (
        <ChartSkeleton key={i} variant={variant} height={i === 0 ? "lg" : "md"} />
      ))}
    </div>
  );
}
