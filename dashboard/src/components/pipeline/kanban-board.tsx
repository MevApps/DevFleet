import type { TaskDTO } from "@/lib/types"
import { TaskCard } from "./task-card"

export function KanbanBoard({ phases, tasksByPhase }: { phases: readonly string[]; tasksByPhase: Record<string, readonly TaskDTO[]> }) {
  return (
    <div className="flex gap-4 overflow-x-auto pb-4">
      {phases.map((phase) => {
        const tasks = tasksByPhase[phase] ?? []
        return (
          <div key={phase} className="flex-shrink-0 w-64 rounded-lg border border-zinc-800 bg-zinc-900 p-3">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-white capitalize">{phase}</h4>
              <span className="text-xs text-zinc-500">{tasks.length}</span>
            </div>
            <div className="space-y-2">
              {tasks.map((task) => <TaskCard key={task.id} task={task} />)}
              {tasks.length === 0 && <p className="text-xs text-zinc-600 text-center py-4">Empty</p>}
            </div>
          </div>
        )
      })}
    </div>
  )
}
