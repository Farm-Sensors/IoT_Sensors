interface SkeletonCardProps {
  className?: string;
  lines?: number;
  showHeader?: boolean;
}

/**
 * Shimmer skeleton loader that matches the Bento Box earthy palette.
 * Use instead of "Cargando..." text during data fetching.
 */
export function SkeletonCard({ className = "", lines = 3, showHeader = true }: SkeletonCardProps) {
  return (
    <div
      className={`bg-[var(--bg-surface)] rounded-[var(--radius)] p-6 overflow-hidden ${className}`}
      role="status"
      aria-label="Cargando..."
    >
      {showHeader && (
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-[var(--radius)] animate-shimmer rounded-full" />
          <div className="flex-1 space-y-2">
            <div className="h-3 w-3/4 rounded-full animate-shimmer" />
            <div className="h-2.5 w-1/2 rounded-full animate-shimmer" />
          </div>
        </div>
      )}
      <div className="space-y-3">
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className="h-3 rounded-full animate-shimmer"
            style={{ width: `${85 - i * 10}%` }}
          />
        ))}
      </div>
    </div>
  );
}

/** Grid of skeleton cards for page-level loading */
export function SkeletonGrid({ count = 4 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  );
}
