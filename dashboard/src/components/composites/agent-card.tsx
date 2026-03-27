"use client"
import type { AgentDTO } from "@/lib/types"
import { EntityIcon } from "@/components/primitives/entity-icon"
import { StatusBadge } from "@/components/primitives/status-badge"
import { TimeAgo } from "@/components/primitives/time-ago"
import { api } from "@/lib/api"
import { useDashboardStore } from "@/lib/store"

export function AgentCard({ agent }: { agent: AgentDTO }) {
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)

  const handlePause = async () => {
    await api.pauseAgent(agent.id, "Manual pause from dashboard")
    await fetchLiveFloor()
  }
  const handleResume = async () => {
    await api.resumeAgent(agent.id)
    await fetchLiveFloor()
  }

  const canPause = agent.status !== "paused" && agent.status !== "idle" && agent.status !== "stopped"
  const canResume = agent.status === "paused"

  return (
    <div
      className="rounded-lg border border-border p-4 group bg-card"
      style={{ borderLeftWidth: "3px", borderLeftColor: "hsl(210, 70%, 50%)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <EntityIcon entity="agent" size="md" />
          <div>
            <div className="text-base font-medium capitalize text-text-primary">{agent.role}</div>
            <div className="text-xs text-text-secondary">{agent.model}</div>
          </div>
        </div>
        <StatusBadge status={agent.status} />
      </div>

      {agent.currentTaskId && (
        <div className="text-sm mb-2 text-text-secondary">
          Working on: <span className="text-text-primary">{agent.currentTaskId}</span>
        </div>
      )}

      <div className="flex items-center justify-between">
        <TimeAgo timestamp={agent.lastActiveAt} showLiveIndicator />
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {canPause && (
            <button onClick={handlePause} className="px-2 py-1 text-xs rounded-sm border border-border text-text-secondary transition-colors">
              Pause
            </button>
          )}
          {canResume && (
            <button onClick={handleResume} className="px-2 py-1 text-xs rounded-sm border border-border text-status-green-fg transition-colors">
              Resume
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
