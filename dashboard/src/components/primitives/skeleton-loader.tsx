import { cn } from "@/lib/utils"

interface SkeletonProps {
  variant?: "line" | "circle" | "card" | "chart"
  lines?: number
  className?: string
}

function SkeletonLine({ className }: { className?: string }) {
  return <div className={cn("h-3 rounded animate-pulse bg-hover", className)} />
}

export function Skeleton({ variant = "line", lines = 3, className }: SkeletonProps) {
  if (variant === "circle") {
    return <div className={cn("h-8 w-8 rounded-full animate-pulse bg-hover", className)} />
  }

  if (variant === "card") {
    return (
      <div className={cn("rounded-lg p-4 border border-border bg-card", className)}>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-8 w-8 rounded-lg animate-pulse bg-hover" />
          <SkeletonLine className="flex-1 h-4" />
          <SkeletonLine className="w-16 h-5 rounded-full" />
        </div>
        <SkeletonLine className="w-3/4 mb-2" />
        <SkeletonLine className="w-full h-1.5" />
      </div>
    )
  }

  if (variant === "chart") {
    return (
      <div className={cn("rounded-lg p-4 border border-border bg-card", className)}>
        <SkeletonLine className="w-32 h-4 mb-3" />
        <div className="h-40 rounded animate-pulse bg-hover" />
      </div>
    )
  }

  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine key={i} className={i === lines - 1 ? "w-2/3" : "w-full"} />
      ))}
    </div>
  )
}
