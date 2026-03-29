"use client"
import type { GoalDTO } from "@/lib/types"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import { useInspectorStore } from "@/lib/inspector-store"
import { StatusBadge } from "@/components/primitives/status-badge"
import { TimeAgo } from "@/components/primitives/time-ago"
import { PhaseLanes } from "./phase-lanes"
import { getGoalTasks, computePhaseSegments, computeTaskProgress, SEGMENT_COLORS } from "@/lib/hooks/use-goal-tasks"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { ChevronRight } from "lucide-react"

const ATTENTION_STATUSES = new Set(["blocked", "failed"])

export function GoalRow({ goal }: { goal: GoalDTO }) {
  const expandedGoalIds = useFloorStore((s) => s.expandedGoalIds)
  const toggleGoalExpanded = useFloorStore((s) => s.toggleGoalExpanded)
  const activeTasks = useDashboardStore((s) => s.activeTasks)
  const openInspector = useInspectorStore((s) => s.open)

  const isExpanded = expandedGoalIds.has(goal.id)
  const tasks = getGoalTasks(activeTasks, goal.id)
  const segments = computePhaseSegments(tasks)
  const { done, total } = computeTaskProgress(tasks, goal.taskCount)
  const needsAttention = ATTENTION_STATUSES.has(goal.status)
  const isCompleted = goal.status === "completed" || goal.status === "merged"
  const budgetUsed = goal.totalBudget.maxCostUsd - goal.totalBudget.remaining

  return (
    <div
      className={cn(
        "rounded-xl border border-border bg-bg-card mb-3 overflow-hidden transition-shadow hover:shadow-sm",
        needsAttention && "border-l-3 border-l-status-yellow-fg",
        isCompleted && "opacity-60",
      )}
    >
      {/* Collapsed header */}
      <button
        onClick={() => toggleGoalExpanded(goal.id)}
        className="flex items-center gap-3 w-full px-4 py-3.5 text-left"
      >
        <ChevronRight
          size={14}
          className={cn(
            "text-text-muted transition-transform shrink-0",
            isExpanded && "rotate-90",
          )}
        />
        <span className="text-[12px] font-mono text-text-muted shrink-0">#{goal.id.slice(0, 6)}</span>
        <span className="text-[14px] font-semibold text-text-primary flex-1 truncate">{goal.description}</span>

        {/* Phase progress bar */}
        <div className="w-[120px] h-1.5 rounded-full bg-border overflow-hidden flex shrink-0">
          {segments.map((seg, i) => (
            <div
              key={i}
              className="h-full"
              style={{ width: `${seg.percent}%`, backgroundColor: SEGMENT_COLORS[seg.type] }}
            />
          ))}
        </div>

        <span className="text-[12px] text-text-muted whitespace-nowrap shrink-0">{done}/{total}</span>
        <span className="text-[12px] font-mono text-text-muted shrink-0">{formatCurrency(budgetUsed)}</span>
        <TimeAgo timestamp={goal.completedAt ?? goal.createdAt} className="text-[12px] text-text-muted shrink-0" />
        <StatusBadge status={goal.status} />
      </button>

      {/* Expanded: Phase Lanes */}
      {isExpanded && (
        <div className="px-4 pb-4 border-t border-border">
          <PhaseLanes
            tasks={tasks}
            onTaskClick={(task) => openInspector(task.id, "task", task.description.split("\n")[0].slice(0, 40))}
          />
        </div>
      )}
    </div>
  )
}
