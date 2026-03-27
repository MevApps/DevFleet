import type { MetricsSummary } from "@/lib/types"

export function MetricsPanel({ metrics }: { metrics: MetricsSummary | null }) {
  if (!metrics) return null
  const cards = [
    { label: "Active Tasks", value: metrics.activeTaskCount },
    { label: "Completed", value: metrics.completedTaskCount },
    { label: "Total Tokens", value: metrics.totalTokensUsed.toLocaleString() },
    { label: "Total Cost", value: `$${metrics.totalCostUsd.toFixed(4)}` },
  ]
  return (
    <div className="grid grid-cols-4 gap-4">
      {cards.map((card) => (
        <div key={card.label} className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs text-zinc-500 mb-1">{card.label}</p>
          <p className="text-xl font-bold text-white">{card.value}</p>
        </div>
      ))}
    </div>
  )
}
