import { cn } from "@/lib/utils/format";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("animate-pulse rounded-lg bg-white/[0.06]", className)}
    />
  );
}

export function PageSkeleton() {
  return (
    <div className="max-w-lg mx-auto pb-24 px-4 pt-6" style={{ background: "#0B0E14", minHeight: "100vh" }}>
      <Skeleton className="h-7 w-40 mb-1" />
      <Skeleton className="h-3 w-24 mb-6" />
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-24 w-full mb-3 rounded-2xl" />
      ))}
    </div>
  );
}

export function CardSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3 px-4">
      {[...Array(count)].map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-2xl" />
      ))}
    </div>
  );
}

export function TableRowSkeleton({ cols = 4, count = 8 }: { cols?: number; count?: number }) {
  return (
    <div className="space-y-0">
      {[...Array(count)].map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
          {[...Array(cols)].map((__, j) => (
            <Skeleton key={j} className={cn("h-4", j === 0 ? "w-8 shrink-0" : j === cols - 1 ? "w-16 shrink-0" : "flex-1")} />
          ))}
        </div>
      ))}
    </div>
  );
}
