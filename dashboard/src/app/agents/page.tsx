"use client"
import { useDashboardStore } from "@/lib/store"
import { usePolling } from "@/hooks/use-polling"
import { AgentCard } from "@/components/composites/agent-card"
import { EmptyState } from "@/components/primitives/empty-state"

export default function AgentsPage() {
  const { agents } = useDashboardStore()
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  usePolling(fetchLiveFloor)

  return (
    <div className="space-y-6">
      {agents.length === 0 ? (
        <EmptyState icon="Bot" title="No agents registered" description="Agents will appear when the system starts" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {agents.map((agent) => (<AgentCard key={agent.id} agent={agent} />))}
        </div>
      )}
    </div>
  )
}
