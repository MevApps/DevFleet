"use client"
import { useDashboardStore } from "@/lib/store"
import { usePolling } from "@/hooks/use-polling"
import { KanbanColumn } from "@/components/composites/kanban-column"
import { GoalCard } from "@/components/composites/goal-card"
import { PHASE_CONFIG } from "@/components/composites/phase-lanes"

export default function PipelinePage() {
  const { phases, tasksByPhase, goals } = useDashboardStore()
  const fetchPipeline = useDashboardStore((s) => s.fetchPipeline)

  usePolling(fetchPipeline)

  return (
    <div className="space-y-6">
      {goals.length > 0 && (
        <div>
          <h2 className="text-lg font-medium mb-3 text-text-primary">Goals</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {goals.map((goal) => (<GoalCard key={goal.id} goal={goal} />))}
          </div>
        </div>
      )}
      <div>
        <h2 className="text-lg font-medium mb-3 text-text-primary">Pipeline</h2>
        <div className="flex gap-4 overflow-x-auto pb-4">
          {phases.map((phase) => (
            <KanbanColumn
              key={phase}
              phase={phase}
              tasks={tasksByPhase[phase] ?? []}
              goals={goals}
              dotColor={PHASE_CONFIG[phase]?.dotColor ?? "var(--status-zinc-fg)"}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
