"use client"
import { useDashboardStore } from "@/lib/store"
import { useInspectorStore } from "@/lib/inspector-store"
import { StatusBadge } from "@/components/primitives/status-badge"
import { ActivityThread } from "@/components/composites/activity-thread"
import { InspStat } from "./insp-stat"
import { api } from "@/lib/api"

interface AgentInspectorProps {
  entityId: string
}

export function AgentInspector({ entityId }: AgentInspectorProps) {
  const agent = useDashboardStore((s) => s.agents.find((a) => a.id === entityId))
  const recentEvents = useDashboardStore((s) => s.recentEvents)
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  const openInspector = useInspectorStore((s) => s.open)

  if (!agent) {
    return <p className="text-sm text-text-muted">Agent not found.</p>
  }

  const agentEvents = recentEvents.filter((e) => e.agentId === agent.id)
  const canPause = agent.status !== "paused" && agent.status !== "idle" && agent.status !== "stopped"
  const canResume = agent.status === "paused"

  const handlePause = async () => {
    await api.pauseAgent(agent.id, "Manual pause from inspector")
    await fetchLiveFloor()
  }
  const handleResume = async () => {
    await api.resumeAgent(agent.id)
    await fetchLiveFloor()
  }

  return (
    <div>
      <h2 className="text-[15px] font-bold text-text-primary mb-3 capitalize">{agent.role}</h2>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <InspStat label="Status"><StatusBadge status={agent.status} /></InspStat>
        <InspStat label="Model">{agent.model}</InspStat>
        <div className="rounded-lg bg-bg-hover p-2.5 col-span-2">
          <p className="text-[11px] text-text-muted">Current Task</p>
          {agent.currentTaskId ? (
            <button
              onClick={() => openInspector(agent.currentTaskId!, "task", agent.currentTaskId!)}
              className="text-[13px] font-mono font-medium text-status-blue-fg hover:underline mt-0.5"
            >
              {agent.currentTaskId}
            </button>
          ) : (
            <p className="text-[13px] text-text-muted mt-0.5">none</p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {canPause && (
          <button onClick={handlePause} className="flex-1 py-2 rounded-lg border border-border text-text-secondary text-[13px] font-semibold hover:bg-bg-hover">
            Pause
          </button>
        )}
        {canResume && (
          <button onClick={handleResume} className="flex-1 py-2 rounded-lg border border-status-green-border text-status-green-fg text-[13px] font-semibold hover:bg-status-green-surface">
            Resume
          </button>
        )}
      </div>

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">Activity</p>
        <ActivityThread events={agentEvents} />
      </div>
    </div>
  )
}
