"use client"
import type { AgentDTO } from "@/lib/types"
import { StatusBadge } from "@/components/ui/status-badge"
import { api } from "@/lib/api"
import { useDashboardStore } from "@/lib/store"

export function AgentCard({ agent }: { agent: AgentDTO }) {
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  const handlePause = async () => { await api.pauseAgent(agent.id, "Manual pause from dashboard"); await fetchLiveFloor() }
  const handleResume = async () => { await api.resumeAgent(agent.id); await fetchLiveFloor() }

  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-semibold text-white capitalize">{agent.role}</h3>
        <StatusBadge status={agent.status} />
      </div>
      <p className="text-xs text-zinc-500 mb-1">ID: {agent.id}</p>
      <p className="text-xs text-zinc-500 mb-1">Model: {agent.model}</p>
      {agent.currentTaskId && <p className="text-xs text-zinc-400 mb-2">Task: {agent.currentTaskId}</p>}
      <div className="flex gap-2 mt-3">
        {agent.status !== "paused" && agent.status !== "idle" && agent.status !== "stopped" && (
          <button onClick={handlePause} className="px-2 py-1 text-xs rounded bg-orange-900/50 text-orange-300 hover:bg-orange-900">Pause</button>
        )}
        {agent.status === "paused" && (
          <button onClick={handleResume} className="px-2 py-1 text-xs rounded bg-green-900/50 text-green-300 hover:bg-green-900">Resume</button>
        )}
      </div>
    </div>
  )
}
