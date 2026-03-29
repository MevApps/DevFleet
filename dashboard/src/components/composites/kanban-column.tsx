// src/components/composites/kanban-column.tsx
import type { TaskDTO, GoalDTO } from "@/lib/types"
import { TaskCard } from "./task-card"
import { getStatusColor } from "@/lib/registry/statuses"

interface KanbanColumnProps {
  phase: string
  tasks: readonly TaskDTO[]
  goals: readonly GoalDTO[]
  dotColor: string
  onTaskClick?: (task: TaskDTO) => void
}

export function KanbanColumn({ phase, tasks, goals, dotColor, onTaskClick }: KanbanColumnProps) {
  const goalMap = new Map(goals.map((g) => [g.id, g]))

  return (
    <div className="flex-1 min-w-0">
      <div className="flex items-center justify-between px-2.5 py-2 bg-bg-card border border-border rounded-t-lg">
        <div className="flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full" style={{ backgroundColor: dotColor }} />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{phase}</span>
        </div>
        <span className="text-[10px] text-text-muted bg-bg-hover px-1.5 py-0.5 rounded-full">{tasks.length}</span>
      </div>
      <div className="bg-bg-page border border-border border-t-0 rounded-b-lg p-2 min-h-[120px]">
        {tasks.length === 0 && (
          <p className="text-[11px] text-text-muted text-center py-6">No tasks</p>
        )}
        {tasks.map((task) => {
          const goal = goalMap.get(task.goalId)
          const color = goal ? getStatusColor(goal.status) : "zinc"
          const goalTag = goal ? {
            label: `#${goal.id.slice(0, 4)}`,
            color: `var(--status-${color}-fg)`,
          } : undefined
          return (
            <TaskCard
              key={task.id}
              task={task}
              compact
              goalTag={goalTag}
              onClick={onTaskClick ? () => onTaskClick(task) : undefined}
            />
          )
        })}
      </div>
    </div>
  )
}
