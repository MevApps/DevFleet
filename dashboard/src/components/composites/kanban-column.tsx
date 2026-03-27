import type { TaskDTO } from "@/lib/types"
import { TaskCard } from "./task-card"
import { EmptyState } from "@/components/primitives/empty-state"

interface KanbanColumnProps {
  phase: string
  tasks: readonly TaskDTO[]
}

export function KanbanColumn({ phase, tasks }: KanbanColumnProps) {
  return (
    <div className="flex-shrink-0 w-72 rounded-lg border border-border p-3 bg-page">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium capitalize text-text-primary">{phase}</h4>
        <span className="px-1.5 py-0.5 rounded-sm text-xs bg-hover text-text-secondary">{tasks.length}</span>
      </div>
      <div className="space-y-2">
        {tasks.length === 0 && (
          <EmptyState icon="Inbox" title="Empty" description="No tasks in this phase" />
        )}
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  )
}
