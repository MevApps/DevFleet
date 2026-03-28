import { StatusBadge } from "@/components/primitives/status-badge"
import { formatCurrency } from "@/lib/utils/format"
import type { WorkspaceGoalSummaryDTO } from "@/lib/types"
import Link from "next/link"

interface WorkspaceGoalLogProps {
  goalSummaries: readonly WorkspaceGoalSummaryDTO[]
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  return `${minutes}m`
}

export function WorkspaceGoalLog({ goalSummaries }: WorkspaceGoalLogProps) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h3 className="text-xs uppercase tracking-wider text-text-muted mb-3">Goal Activity</h3>

      {goalSummaries.length === 0 ? (
        <p className="text-sm text-text-secondary py-4 text-center">
          No goals yet. Create goals from the{" "}
          <Link href="/" className="text-blue-400 hover:underline">Live Floor</Link> page.
        </p>
      ) : (
        <div className="space-y-2">
          {goalSummaries.map((goal) => (
            <div key={goal.goalId} className="flex items-center justify-between py-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <StatusBadge status={goal.status} />
                <span className="text-sm text-text-primary truncate">{goal.description}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0 ml-3">
                <span className="text-xs text-text-muted">
                  {formatCurrency(goal.costUsd)} · {formatDuration(goal.durationMs)}
                </span>
                {goal.prUrl && (
                  <a
                    href={goal.prUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-blue-400 hover:underline"
                  >
                    PR
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-3 pt-3 border-t border-border">
        <p className="text-xs text-text-muted">
          Create goals from the{" "}
          <Link href="/" className="text-blue-400 hover:underline">Live Floor</Link> page
        </p>
      </div>
    </div>
  )
}
