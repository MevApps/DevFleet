"use client"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import { cn } from "@/lib/utils"
import { getStatusColor } from "@/lib/registry/statuses"

export function FilterBar() {
  const goals = useDashboardStore((s) => s.goals)
  const kanbanGoalFilter = useFloorStore((s) => s.kanbanGoalFilter)
  const setKanbanGoalFilter = useFloorStore((s) => s.setKanbanGoalFilter)

  if (goals.length === 0) return null

  return (
    <div data-testid="filter-bar" className="flex items-center gap-2 mb-4 p-3 bg-bg-card border border-border rounded-lg overflow-x-auto">
      <span className="text-[12px] text-text-muted font-medium shrink-0">Filter by goal:</span>
      <button
        onClick={() => setKanbanGoalFilter(null)}
        className={cn(
          "px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors shrink-0",
          kanbanGoalFilter === null
            ? "bg-text-primary text-text-inverse border-text-primary"
            : "bg-bg-card text-text-secondary border-border hover:bg-bg-hover",
        )}
      >
        All Goals
      </button>
      {goals.map((goal) => {
        const isActive = kanbanGoalFilter === goal.id
        const color = getStatusColor(goal.status)
        return (
          <button
            key={goal.id}
            onClick={() => setKanbanGoalFilter(isActive ? null : goal.id)}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium border transition-colors shrink-0",
              isActive
                ? "bg-text-primary text-text-inverse border-text-primary"
                : "bg-bg-card text-text-secondary border-border hover:bg-bg-hover",
            )}
          >
            <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: `var(--status-${color}-fg)` }} />
            #{goal.id.slice(0, 4)} {goal.description.slice(0, 20)}{goal.description.length > 20 ? "..." : ""}
          </button>
        )
      })}
    </div>
  )
}
