"use client"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import { useInspectorStore } from "@/lib/inspector-store"
import { StatusBadge } from "@/components/primitives/status-badge"
import { PhaseLanes } from "./phase-lanes"
import { getGoalTasks, computePhaseSegments, computeTaskProgress, SEGMENT_COLORS } from "@/lib/hooks/use-goal-tasks"
import { formatCurrency, formatElapsed } from "@/lib/utils/format"
import { ChevronLeft } from "lucide-react"

export function GoalFocusView() {
  const focusedGoalId = useFloorStore((s) => s.focusedGoalId)
  const unfocusGoal = useFloorStore((s) => s.unfocusGoal)
  const goals = useDashboardStore((s) => s.goals)
  const allTasks = useDashboardStore((s) => s.allTasks)
  const agents = useDashboardStore((s) => s.agents)
  const openInspector = useInspectorStore((s) => s.open)

  const goal = goals.find((g) => g.id === focusedGoalId)
  if (!goal) {
    return <p className="text-sm text-text-muted p-4">Goal not found.</p>
  }

  const tasks = getGoalTasks(allTasks, goal.id)
  const segments = computePhaseSegments(tasks)
  const { done, total } = computeTaskProgress(tasks, goal.taskCount)
  const budgetUsed = goal.totalBudget.maxCostUsd - goal.totalBudget.remaining
  const goalAgents = [...new Set(tasks.filter((t) => t.assignedTo).map((t) => t.assignedTo!))]
  const inProgressCount = tasks.filter((t) => t.status === "in_progress").length

  return (
    <div>
      {/* Goal header */}
      <div className="flex items-start gap-4 mb-5 pb-4 border-b border-border">
        <button
          onClick={unfocusGoal}
          className="p-1.5 rounded-lg border border-border bg-bg-card text-text-muted hover:bg-bg-hover shrink-0 mt-0.5"
          aria-label="Back to all goals"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-[13px] font-mono text-text-muted">#{goal.id.slice(0, 8)}</span>
            <StatusBadge status={goal.status} />
          </div>
          <h1 className="text-[20px] font-bold text-text-primary leading-tight">{goal.description}</h1>
          <div className="flex items-center gap-4 mt-2 text-[13px] text-text-muted">
            <span>Created <strong className="text-text-secondary">{formatElapsed(goal.createdAt)}</strong> ago</span>
            <span className="font-mono">{formatCurrency(budgetUsed)} / {formatCurrency(goal.totalBudget.maxCostUsd)}</span>
            <span>{done} of {total} tasks</span>
          </div>
          {/* Phase progress bar */}
          <div className="h-2 rounded bg-border overflow-hidden flex mt-3">
            {segments.map((seg, i) => (
              <div
                key={i}
                className="h-full"
                style={{ width: `${seg.percent}%`, backgroundColor: SEGMENT_COLORS[seg.type] }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-4 gap-3 mb-5">
        <StatCard label="Tasks" value={`${done}/${total}`} sub={`${inProgressCount} in progress`} />
        <StatCard label="Agents" value={String(goalAgents.length)} sub={goalAgents.slice(0, 3).join(", ") || "none"} />
        <StatCard label="Budget" value={formatCurrency(budgetUsed)} sub={`${Math.round((budgetUsed / goal.totalBudget.maxCostUsd) * 100)}% of ${formatCurrency(goal.totalBudget.maxCostUsd)}`} />
        <StatCard label="Duration" value={formatElapsed(goal.createdAt)} sub={total > 0 ? `avg ${Math.round(((Date.now() - new Date(goal.createdAt).getTime()) / 1000 / Math.max(done, 1)))}s/task` : "—"} />
      </div>

      {/* Phase lanes */}
      <div>
        <h2 className="text-[13px] font-bold text-text-primary mb-3">Tasks by Phase</h2>
        <PhaseLanes
          tasks={tasks}
          onTaskClick={(task) => openInspector(task.id, "task", task.description.split("\n")[0].slice(0, 40))}
        />
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-bg-card p-3.5">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">{label}</p>
      <p className="text-[20px] font-bold font-mono text-text-primary mt-1">{value}</p>
      <p className="text-[11px] text-text-muted mt-0.5">{sub}</p>
    </div>
  )
}
