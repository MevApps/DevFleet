"use client"
import { useDashboardStore } from "@/lib/store"
import { usePolling } from "@/hooks/use-polling"
import { MetricsRow } from "@/components/composites/metrics-row"
import { AgentCard } from "@/components/composites/agent-card"
import { ActivityFeed } from "@/components/composites/activity-feed"
import { CreateGoalForm } from "@/components/composites/create-goal-form"
import { useCallback } from "react"

export default function LiveFloorPage() {
  const { agents, recentEvents, metrics } = useDashboardStore()
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  const fetchMetrics = useDashboardStore((s) => s.fetchMetrics)

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchLiveFloor(), fetchMetrics()])
  }, [fetchLiveFloor, fetchMetrics])

  usePolling(fetchAll)

  return (
    <div className="space-y-6">
      <MetricsRow metrics={metrics} />
      <CreateGoalForm />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
      <ActivityFeed events={recentEvents} />
    </div>
  )
}
