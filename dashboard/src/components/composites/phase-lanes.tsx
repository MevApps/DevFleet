"use client"
import type { TaskDTO } from "@/lib/types"
import { TaskCard } from "./task-card"
import { getTaskDisplayPhase } from "@/lib/hooks/use-goal-tasks"
import { ArrowRight } from "lucide-react"

export const PHASES = ["planning", "implementation", "review", "done"] as const

export const PHASE_CONFIG: Record<string, { label: string; dotColor: string }> = {
  planning: { label: "Planning", dotColor: "var(--status-green-fg)" },
  implementation: { label: "Implementation", dotColor: "var(--status-blue-fg)" },
  review: { label: "Review", dotColor: "var(--status-purple-fg)" },
  done: { label: "Done", dotColor: "var(--status-green-fg)" },
}

interface PhaseLanesProps {
  tasks: readonly TaskDTO[]
  onTaskClick: (task: TaskDTO) => void
}

export function PhaseLanes({ tasks, onTaskClick }: PhaseLanesProps) {
  const tasksByPhase: Record<string, TaskDTO[]> = { planning: [], implementation: [], review: [], done: [] }
  for (const task of tasks) {
    const phase = getTaskDisplayPhase(task)
    if (tasksByPhase[phase]) tasksByPhase[phase].push(task)
    else tasksByPhase.implementation.push(task)
  }

  return (
    <div className="flex gap-3 pt-3">
      {PHASES.map((phase, i) => {
        const config = PHASE_CONFIG[phase]
        const phaseTasks = tasksByPhase[phase]
        return (
          <div key={phase} className="flex items-start gap-3 flex-1 min-w-0">
            {i > 0 && (
              <div className="flex items-center justify-center w-5 shrink-0 pt-8">
                <ArrowRight size={14} className="text-text-muted opacity-30" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: config.dotColor }} />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{config.label}</span>
                </div>
                <span className="text-[10px] text-text-muted bg-bg-hover px-1.5 py-0.5 rounded-full">{phaseTasks.length}</span>
              </div>
              <div className="min-h-[60px]">
                {phaseTasks.length === 0 && (
                  <p className="text-[11px] text-text-muted text-center py-4">No tasks</p>
                )}
                {phaseTasks.map((task) => (
                  <TaskCard key={task.id} task={task} compact onClick={() => onTaskClick(task)} />
                ))}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
