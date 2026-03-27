"use client"
import { useDashboardStore } from "@/lib/store"
import { usePolling } from "@/hooks/use-polling"
import { TaskCard } from "@/components/composites/task-card"
import { EmptyState } from "@/components/primitives/empty-state"

export default function TasksPage() {
  const { phases, tasksByPhase } = useDashboardStore()
  const fetchPipeline = useDashboardStore((s) => s.fetchPipeline)
  usePolling(fetchPipeline)

  const allTasks = phases.flatMap((phase) => tasksByPhase[phase] ?? [])

  return (
    <div className="space-y-6">
      {allTasks.length === 0 ? (
        <EmptyState icon="CheckSquare" title="No tasks" description="Tasks are created when goals are decomposed" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {allTasks.map((task) => (<TaskCard key={task.id} task={task} />))}
        </div>
      )}
    </div>
  )
}
