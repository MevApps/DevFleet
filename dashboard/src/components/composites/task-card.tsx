// src/components/composites/task-card.tsx
import type { TaskDTO } from "@/lib/types"
import { EntityIcon } from "@/components/primitives/entity-icon"
import { StatusBadge } from "@/components/primitives/status-badge"
import { ProgressBar } from "@/components/primitives/progress-bar"
import { formatTokens } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface TaskCardProps {
  task: TaskDTO
  compact?: boolean
  goalTag?: { label: string; color: string }
  onClick?: () => void
}

export function TaskCard({ task, compact, goalTag, onClick }: TaskCardProps) {
  const budgetRatio = task.budget.maxTokens > 0 ? task.tokensUsed / task.budget.maxTokens : 0

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={cn(
          "w-full text-left rounded-lg border border-border p-2.5 bg-bg-card transition-colors mb-2",
          onClick && "hover:border-border-hover cursor-pointer",
        )}
      >
        <p className="text-[13px] font-medium text-text-primary leading-snug">
          {task.description.split("\n")[0].slice(0, 50)}{task.description.length > 50 ? "..." : ""}
        </p>
        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-text-muted">
          {task.assignedTo && (
            <span className="px-1.5 py-0.5 rounded bg-status-blue-surface text-status-blue-fg font-mono text-[10px]">
              {task.assignedTo}
            </span>
          )}
          {!task.assignedTo && <span>queued</span>}
          {goalTag && (
            <span
              className="px-1.5 py-0.5 rounded text-[10px] font-semibold"
              style={{ backgroundColor: `${goalTag.color}15`, color: goalTag.color }}
            >
              {goalTag.label}
            </span>
          )}
        </div>
        {task.status === "in_progress" && budgetRatio > 0 && (
          <div className="h-[3px] rounded-full bg-border mt-1.5 overflow-hidden">
            <div className="h-full rounded-full bg-status-blue-fg" style={{ width: `${Math.min(budgetRatio * 100, 100)}%` }} />
          </div>
        )}
      </button>
    )
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border p-4 bg-card",
        onClick && "cursor-pointer hover:border-border-hover",
      )}
      style={{ borderLeftWidth: "3px", borderLeftColor: "hsl(125, 70%, 40%)" }}
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <EntityIcon entity="task" size="md" />
          <div>
            <div className="text-sm font-medium text-text-primary leading-snug">{task.description.split("\n")[0].slice(0, 60)}{task.description.length > 60 ? "..." : ""}</div>
            <div className="text-xs text-text-muted">{task.phase} &middot; #{task.id.slice(0, 6)}</div>
          </div>
        </div>
        <StatusBadge status={task.status} />
      </div>

      <div className="flex gap-3 text-xs mb-2 text-text-secondary">
        <span>Phase: <span className="text-status-purple-fg">{task.phase}</span></span>
        {task.assignedTo && <span>Agent: <span className="text-text-primary">{task.assignedTo}</span></span>}
      </div>

      <ProgressBar value={budgetRatio} label="Budget" showPercent thresholds={{ warn: 0.5, critical: 0.8 }} />
      <div className="text-xs font-mono mt-1 text-text-secondary">
        {formatTokens(task.tokensUsed)} / {formatTokens(task.budget.maxTokens)} tokens
      </div>
    </div>
  )
}
