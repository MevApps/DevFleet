"use client"
import { useDashboardStore } from "@/lib/store"
import { StatusBadge } from "@/components/primitives/status-badge"
import { ActivityThread } from "@/components/composites/activity-thread"
import { InspStat } from "./insp-stat"
import { getGoalTasks, computeTaskProgress, computePhaseSegments, SEGMENT_COLORS } from "@/lib/hooks/use-goal-tasks"
import { formatCurrency } from "@/lib/utils/format"

interface GoalInspectorProps {
  entityId: string
}

export function GoalInspector({ entityId }: GoalInspectorProps) {
  const goal = useDashboardStore((s) => s.goals.find((g) => g.id === entityId))
  const allTasks = useDashboardStore((s) => s.allTasks)
  const recentEvents = useDashboardStore((s) => s.recentEvents)

  if (!goal) {
    return <p className="text-sm text-text-muted">Goal not found.</p>
  }

  const tasks = getGoalTasks(allTasks, goal.id)
  const { done, total } = computeTaskProgress(tasks, goal.taskCount)
  const segments = computePhaseSegments(tasks)
  const budgetUsed = goal.totalBudget.maxCostUsd - goal.totalBudget.remaining
  const goalEvents = recentEvents.filter((e) => e.goalId === goal.id)

  return (
    <div>
      <h2 className="text-[15px] font-bold text-text-primary mb-3">{goal.description}</h2>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <InspStat label="Status"><StatusBadge status={goal.status} /></InspStat>
        <InspStat label="Tasks">{done}/{total}</InspStat>
        <InspStat label="Budget">{formatCurrency(budgetUsed)} / {formatCurrency(goal.totalBudget.maxCostUsd)}</InspStat>
        <InspStat label="Task Count">{goal.taskCount}</InspStat>
      </div>

      <div className="h-1.5 rounded-full bg-border overflow-hidden flex mb-4">
        {segments.map((seg, i) => (
          <div key={i} className="h-full" style={{ width: `${seg.percent}%`, backgroundColor: SEGMENT_COLORS[seg.type] }} />
        ))}
      </div>

      {tasks.length > 0 && (
        <div className="mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">Tasks</p>
          {tasks.map((task) => (
            <div key={task.id} className="flex items-center justify-between py-1.5 border-b border-border last:border-b-0 text-[12px]">
              <span className="text-text-primary truncate flex-1">{task.description.split("\n")[0].slice(0, 40)}</span>
              <StatusBadge status={task.status} />
            </div>
          ))}
        </div>
      )}

      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted mb-2">Activity</p>
        <ActivityThread events={goalEvents} />
      </div>
    </div>
  )
}
