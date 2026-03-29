"use client"
import { useDashboardStore } from "@/lib/store"
import { useFloorStore } from "@/lib/floor-store"
import { useInspectorStore } from "@/lib/inspector-store"
import { KanbanColumn } from "./kanban-column"
import { FilterBar } from "./filter-bar"
import { PHASES, PHASE_CONFIG } from "./phase-lanes"
import { getTaskDisplayPhase } from "@/lib/hooks/use-goal-tasks"

export function KanbanView() {
  const activeTasks = useDashboardStore((s) => s.activeTasks)
  const goals = useDashboardStore((s) => s.goals)
  const kanbanGoalFilter = useFloorStore((s) => s.kanbanGoalFilter)
  const openInspector = useInspectorStore((s) => s.open)

  const filteredTasks = kanbanGoalFilter
    ? activeTasks.filter((t) => t.goalId === kanbanGoalFilter)
    : activeTasks

  const tasksByPhase: Record<string, typeof filteredTasks[number][]> = Object.fromEntries(
    PHASES.map((p) => [p, []])
  )
  for (const task of filteredTasks) {
    const phase = getTaskDisplayPhase(task)
    if (tasksByPhase[phase]) tasksByPhase[phase].push(task)
    else tasksByPhase.implementation.push(task)
  }

  return (
    <div>
      <FilterBar />
      <div className="flex gap-3">
        {PHASES.map((phase) => {
          const config = PHASE_CONFIG[phase]
          return (
            <KanbanColumn
              key={phase}
              phase={config.label}
              tasks={tasksByPhase[phase]}
              goals={goals}
              dotColor={config.dotColor}
              onTaskClick={(task) => openInspector(task.id, "task", task.description.split("\n")[0].slice(0, 40))}
            />
          )
        })}
      </div>
    </div>
  )
}
