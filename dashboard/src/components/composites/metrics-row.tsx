import { MetricValue } from "@/components/primitives/metric-value"
import type { MetricsSummary } from "@/lib/types"
import { Skeleton } from "@/components/primitives/skeleton-loader"

export function MetricsRow({ metrics }: { metrics: MetricsSummary | null }) {
  if (!metrics) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-lg border border-border p-4 bg-card">
            <Skeleton variant="line" lines={2} />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {[
        { label: "Active Tasks", value: metrics.activeTaskCount, format: "number" as const },
        { label: "Completed", value: metrics.completedTaskCount, format: "number" as const },
        { label: "Total Tokens", value: metrics.totalTokensUsed, format: "tokens" as const },
        { label: "Total Cost", value: metrics.totalCostUsd, format: "currency" as const },
      ].map((m) => (
        <div key={m.label} className="rounded-lg border border-border p-4 bg-card">
          <MetricValue label={m.label} value={m.value} format={m.format} />
        </div>
      ))}
    </div>
  )
}
