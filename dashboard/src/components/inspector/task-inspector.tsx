"use client"
import { useState } from "react"
import { useDashboardStore } from "@/lib/store"
import { StatusBadge } from "@/components/primitives/status-badge"
import { ActivityThread } from "@/components/composites/activity-thread"
import { DiffViewer } from "@/components/composites/diff-viewer"
import { InspStat } from "./insp-stat"
import { formatCurrency } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

const REVIEW_STATUSES = new Set(["review", "pending_review"])
const FAILED_STATUSES = new Set(["failed"])

type Tab = "diff" | "artifacts" | "activity"

interface TaskInspectorProps {
  entityId: string
}

export function TaskInspector({ entityId }: TaskInspectorProps) {
  const task = useDashboardStore((s) => s.activeTasks.find((t) => t.id === entityId))
  const recentEvents = useDashboardStore((s) => s.recentEvents)
  const [activeTab, setActiveTab] = useState<Tab>("diff")

  if (!task) {
    return <p className="text-sm text-text-muted">Task not found.</p>
  }

  const taskEvents = recentEvents.filter((e) => e.taskId === task.id)
  const isReview = REVIEW_STATUSES.has(task.status)
  const isFailed = FAILED_STATUSES.has(task.status)

  return (
    <div>
      <h2 className="text-[15px] font-bold text-text-primary mb-3">{task.description.split("\n")[0]}</h2>

      <div className="grid grid-cols-2 gap-2.5 mb-4">
        <InspStat label="Status"><StatusBadge status={task.status} /></InspStat>
        <InspStat label="Agent">{task.assignedTo ?? "unassigned"}</InspStat>
        <InspStat label="Budget">{formatCurrency(task.budget.maxCostUsd - task.budget.remaining)}</InspStat>
        <InspStat label="Attempt">{task.retryCount + 1}/3</InspStat>
      </div>

      <div className="flex border-b border-border mb-3">
        {(["diff", "artifacts", "activity"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-3.5 py-2 text-[12px] font-medium border-b-2 transition-colors capitalize",
              activeTab === tab
                ? "text-text-primary border-status-purple-fg"
                : "text-text-muted border-transparent hover:text-text-secondary",
            )}
          >
            {tab === "diff" ? "Diff" : tab === "artifacts" ? "Artifacts" : "Activity"}
          </button>
        ))}
      </div>

      {activeTab === "diff" && <DiffViewer files={[]} />}
      {activeTab === "artifacts" && <p className="text-[11px] text-text-muted py-3">No artifacts.</p>}
      {activeTab === "activity" && <ActivityThread events={taskEvents} />}

      <div className="flex gap-2 mt-4">
        {isReview && (
          <>
            <button className="flex-1 py-2 rounded-lg bg-text-primary text-text-inverse text-[13px] font-semibold">
              Approve &amp; Merge
            </button>
            <button className="flex-1 py-2 rounded-lg border border-status-red-border text-status-red-fg text-[13px] font-semibold">
              Discard
            </button>
            <button className="flex-1 py-2 rounded-lg border border-border text-text-secondary text-[13px] font-semibold">
              Reassign
            </button>
          </>
        )}
        {isFailed && (
          <>
            <button className="flex-1 py-2 rounded-lg bg-text-primary text-text-inverse text-[13px] font-semibold">
              Retry
            </button>
            <button className="flex-1 py-2 rounded-lg border border-border text-text-secondary text-[13px] font-semibold">
              Reassign
            </button>
            <button className="flex-1 py-2 rounded-lg border border-status-red-border text-status-red-fg text-[13px] font-semibold">
              Discard
            </button>
          </>
        )}
      </div>
    </div>
  )
}
