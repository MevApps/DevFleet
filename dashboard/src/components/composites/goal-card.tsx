import type { GoalDTO } from "@/lib/types"
import { EntityIcon } from "@/components/primitives/entity-icon"
import { StatusBadge } from "@/components/primitives/status-badge"
import { ProgressRing } from "@/components/primitives/progress-ring"
import { formatCurrency } from "@/lib/utils/format"
import { TimeAgo } from "@/components/primitives/time-ago"

export function GoalCard({ goal }: { goal: GoalDTO }) {
  const budgetRatio = goal.totalBudget.maxCostUsd > 0
    ? (goal.totalBudget.maxCostUsd - goal.totalBudget.remaining) / goal.totalBudget.maxCostUsd
    : 0

  return (
    <div
      className="rounded-lg border border-border p-4 bg-card"
      style={{ borderLeftWidth: "3px", borderLeftColor: "hsl(348, 70%, 50%)" }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <EntityIcon entity="goal" size="md" />
          <div>
            <div className="text-base font-medium text-text-primary">{goal.description}</div>
            <div className="text-xs text-text-secondary">
              {goal.taskCount} tasks · <TimeAgo timestamp={goal.createdAt} />
            </div>
          </div>
        </div>
        <StatusBadge status={goal.status} />
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-text-secondary">
          {formatCurrency(goal.totalBudget.maxCostUsd - goal.totalBudget.remaining)} / {formatCurrency(goal.totalBudget.maxCostUsd)}
        </span>
        <ProgressRing value={budgetRatio} size="sm" thresholds={{ warn: 0.5, critical: 0.8 }} />
      </div>
    </div>
  )
}
