"use client"
import { useDashboardStore } from "@/lib/store"
import { useWorkspaceStore } from "@/lib/workspace-store"
import { usePolling } from "@/hooks/use-polling"
import { MetricsRow } from "@/components/composites/metrics-row"
import { AgentCard } from "@/components/composites/agent-card"
import { ActivityFeed } from "@/components/composites/activity-feed"
import { CreateGoalForm } from "@/components/composites/create-goal-form"
import { WorkspaceRequiredNotice } from "@/components/composites/workspace-required-notice"
import { useCallback } from "react"
import Link from "next/link"

export default function LiveFloorPage() {
  const { agents, recentEvents, metrics } = useDashboardStore()
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  const fetchMetrics = useDashboardStore((s) => s.fetchMetrics)
  const run = useWorkspaceStore((s) => s.run)

  const fetchAll = useCallback(async () => {
    await Promise.all([fetchLiveFloor(), fetchMetrics()])
  }, [fetchLiveFloor, fetchMetrics])

  usePolling(fetchAll)

  const isActive = run?.status === "active"
  const repoName = run?.config.repoUrl.split("/").pop() ?? ""

  return (
    <div className="space-y-6">
      {/* Workspace banner */}
      {isActive ? (
        <div className="rounded-lg border border-status-blue-border bg-status-blue-surface px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-status-blue-fg animate-pulse" />
            <span className="text-sm text-status-blue-fg font-medium">Workspace active:</span>
            <span className="text-sm text-text-primary">{repoName}</span>
            <span className="text-xs text-text-muted">— goals target this workspace</span>
          </div>
          <Link href="/workspace" className="text-xs text-status-blue-fg font-medium hover:underline">
            View Workspace →
          </Link>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-base">📦</span>
            <span className="text-sm text-text-primary">No workspace running</span>
            <span className="text-xs text-text-muted">— Start a workspace to begin creating goals.</span>
          </div>
          <Link href="/workspace" className="text-xs text-blue-400 font-medium hover:underline">
            Start Workspace →
          </Link>
        </div>
      )}

      <MetricsRow metrics={metrics} />

      {/* Goal form or workspace required notice */}
      {isActive ? (
        <CreateGoalForm workspaceRepoName={repoName} />
      ) : (
        <WorkspaceRequiredNotice />
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {agents.map((agent) => (
          <AgentCard key={agent.id} agent={agent} />
        ))}
      </div>
      <ActivityFeed events={recentEvents} />
    </div>
  )
}
