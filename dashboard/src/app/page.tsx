"use client"
import { useEffect } from "react"
import { useDashboardStore } from "@/lib/store"
import { useSSE } from "@/lib/useSSE"
import { AgentCard } from "@/components/live-floor/agent-card"
import { ActivityFeed } from "@/components/live-floor/activity-feed"
import { MetricsPanel } from "@/components/metrics/metrics-panel"
import { CreateGoalForm } from "@/components/ceo/create-goal-form"

export default function LiveFloorPage() {
  const { agents, activeTasks, recentEvents, metrics, fetchLiveFloor, fetchMetrics } = useDashboardStore()
  useSSE()

  useEffect(() => {
    void fetchLiveFloor(); void fetchMetrics()
    const interval = setInterval(() => { void fetchLiveFloor(); void fetchMetrics() }, 10_000)
    return () => clearInterval(interval)
  }, [fetchLiveFloor, fetchMetrics])

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-white">Live Floor</h2>
      <MetricsPanel metrics={metrics} />
      <CreateGoalForm />
      <div>
        <h3 className="text-lg font-semibold text-white mb-3">Agents</h3>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {agents.map((agent) => <AgentCard key={agent.id} agent={agent} />)}
        </div>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <h3 className="text-lg font-semibold text-white mb-3">Active Tasks ({activeTasks.length})</h3>
          <div className="space-y-2">
            {activeTasks.map((task) => (
              <div key={task.id} className="rounded border border-zinc-800 bg-zinc-900 p-3 text-sm">
                <div className="flex justify-between"><span className="text-white">{task.description}</span><span className="text-xs text-zinc-500">{task.phase} / {task.status}</span></div>
                {task.assignedTo && <p className="text-xs text-zinc-500 mt-1">Assigned: {task.assignedTo}</p>}
              </div>
            ))}
            {activeTasks.length === 0 && <p className="text-sm text-zinc-500">No active tasks</p>}
          </div>
        </div>
        <ActivityFeed events={recentEvents} />
      </div>
    </div>
  )
}
