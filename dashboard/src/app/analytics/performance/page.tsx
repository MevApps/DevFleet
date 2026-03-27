"use client"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { TimingsData } from "@/lib/types"
import { MetricValue } from "@/components/primitives/metric-value"
import { DFBarChart } from "@/components/charts/bar-chart"
import { EmptyState } from "@/components/primitives/empty-state"
import { Skeleton } from "@/components/primitives/skeleton-loader"
import { StatusBadge } from "@/components/primitives/status-badge"

export default function PerformancePage() {
  const [data, setData] = useState<TimingsData | null>(null)

  useEffect(() => {
    api.timings().then(setData)
    const interval = setInterval(() => api.timings().then(setData), 10_000)
    return () => clearInterval(interval)
  }, [])

  if (!data) {
    return (
      <div className="space-y-4">
        <Skeleton variant="card" />
        <Skeleton variant="chart" />
      </div>
    )
  }

  const phaseData = Object.entries(data.avgDurationByPhase).map(([name, ms]) => ({
    name,
    duration: Math.round(ms / 1000),
  }))

  return (
    <div className="space-y-6">
      {data.stalledPhases.length > 0 && (
        <div className="rounded-lg border p-4 border-status-yellow-border bg-status-yellow-surface">
          <h3 className="text-base font-medium mb-2 text-status-yellow-fg">Stalled Phases</h3>
          <div className="flex gap-2">
            {data.stalledPhases.map((s) => (<StatusBadge key={s.phase} status="warning" />))}
          </div>
        </div>
      )}

      <div className="rounded-lg border border-border p-4 bg-card">
        <h3 className="text-base font-medium mb-3 text-text-primary">Average Phase Duration (seconds)</h3>
        {phaseData.length === 0 ? (
          <EmptyState icon="Timer" title="No timing data" description="Timing data appears after tasks complete" />
        ) : (
          <DFBarChart data={phaseData} dataKey="duration" nameKey="name" layout="horizontal" height={250} />
        )}
      </div>

      <div className="rounded-lg border border-border p-4 bg-card">
        <h3 className="text-base font-medium mb-3 text-text-primary">Agent Efficiency</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(data.agentEfficiency).map(([agent, score]) => (
            <MetricValue key={agent} label={agent} value={score} format="percent" />
          ))}
        </div>
      </div>
    </div>
  )
}
