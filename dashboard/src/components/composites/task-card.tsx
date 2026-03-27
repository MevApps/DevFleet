import type { TaskDTO } from "@/lib/types"
import { EntityIcon } from "@/components/primitives/entity-icon"
import { StatusBadge } from "@/components/primitives/status-badge"
import { ProgressBar } from "@/components/primitives/progress-bar"
import { formatTokens } from "@/lib/utils/format"

export function TaskCard({ task }: { task: TaskDTO }) {
  const budgetRatio = task.budget.maxTokens > 0 ? task.tokensUsed / task.budget.maxTokens : 0

  return (
    <div
      className="rounded-lg border border-border p-4 bg-card"
      style={{ borderLeftWidth: "3px", borderLeftColor: "hsl(125, 70%, 40%)" }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <EntityIcon entity="task" size="md" />
          <div>
            <div className="text-base font-medium text-text-primary">Task #{task.id.slice(0, 6)}</div>
            <div className="text-xs text-text-secondary">Goal: {task.goalId.slice(0, 8)}</div>
          </div>
        </div>
        <StatusBadge status={task.status} />
      </div>

      <p className="text-sm mb-2 text-text-secondary">{task.description}</p>

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
