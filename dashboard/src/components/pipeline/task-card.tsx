import type { TaskDTO } from "@/lib/types"
import { StatusBadge } from "@/components/ui/status-badge"

export function TaskCard({ task }: { task: TaskDTO }) {
  const budgetPct = task.budget.maxTokens > 0 ? Math.round((task.tokensUsed / task.budget.maxTokens) * 100) : 0
  return (
    <div className="rounded border border-zinc-700 bg-zinc-800 p-3 text-sm">
      <div className="flex items-start justify-between mb-1">
        <p className="text-white text-xs font-medium leading-tight">{task.description}</p>
        <StatusBadge status={task.status} />
      </div>
      {task.assignedTo && <p className="text-xs text-zinc-500 mt-1">{task.assignedTo}</p>}
      <div className="mt-2">
        <div className="flex justify-between text-xs text-zinc-500 mb-1"><span>Budget</span><span>{budgetPct}%</span></div>
        <div className="h-1 bg-zinc-700 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${budgetPct > 80 ? "bg-red-500" : budgetPct > 50 ? "bg-yellow-500" : "bg-green-500"}`} style={{ width: `${Math.min(budgetPct, 100)}%` }} />
        </div>
      </div>
    </div>
  )
}
