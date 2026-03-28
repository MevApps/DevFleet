"use client"
import { useCallback } from "react"
import { useWorkspaceStore } from "@/lib/workspace-store"
import { usePolling } from "@/hooks/use-polling"
import { api } from "@/lib/api"
import { WorkspaceSetupForm } from "@/components/composites/workspace-setup-form"
import { WorkspaceBootProgress } from "@/components/composites/workspace-boot-progress"
import { WorkspaceGoalLog } from "@/components/composites/workspace-goal-log"
import { MetricValue } from "@/components/primitives/metric-value"
import { StatusBadge } from "@/components/primitives/status-badge"
import { formatElapsed } from "@/lib/utils/format"
import { useState } from "react"

const BOOT_STATUSES = new Set(["created", "cloning", "installing", "detecting"])

export default function WorkspacePage() {
  const run = useWorkspaceStore((s) => s.run)
  const goalSummaries = useWorkspaceStore((s) => s.goalSummaries)
  const costUsd = useWorkspaceStore((s) => s.costUsd)
  const setStatus = useWorkspaceStore((s) => s.setStatus)
  const clear = useWorkspaceStore((s) => s.clear)
  const [stopError, setStopError] = useState<string | null>(null)
  const [stopping, setStopping] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [cleanupError, setCleanupError] = useState<string | null>(null)
  const [clonePath, setClonePath] = useState<string | null>(null)

  const fetchStatus = useCallback(async () => {
    try {
      const status = await api.workspaceStatus()
      setStatus(status)
    } catch {
      clear()
    }
  }, [setStatus, clear])

  usePolling(fetchStatus)

  const handleStop = async () => {
    setStopping(true)
    setStopError(null)
    try {
      const result = await api.workspaceStop()
      if (result.clonePath) setClonePath(result.clonePath)
      await fetchStatus()
    } catch (err) {
      setStopError(err instanceof Error ? err.message : "Failed to stop workspace")
    } finally {
      setStopping(false)
    }
  }

  const handleCleanup = async () => {
    setCleaning(true)
    setCleanupError(null)
    try {
      await api.workspaceCleanup()
      clear()
    } catch {
      setCleanupError("Cleanup failed.")
      await fetchStatus()
    } finally {
      setCleaning(false)
    }
  }

  const status = run?.status

  // State 1: No workspace or stopped
  if (!run || status === "stopped") {
    return <WorkspaceSetupForm />
  }

  // State 1+: Failed
  if (status === "failed") {
    return <WorkspaceSetupForm errorMessage={run.error} />
  }

  // State 1.5: Booting
  if (status && BOOT_STATUSES.has(status)) {
    return (
      <WorkspaceBootProgress
        status={status}
        repoUrl={run.config.repoUrl}
        startedAt={run.startedAt}
      />
    )
  }

  // State 3: Stopped dirty
  if (status === "stopped_dirty") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-status-yellow-border bg-status-yellow-surface p-4 flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-text-primary">Workspace stopped with failed goals</p>
            <p className="text-xs text-text-secondary mt-1">
              Clone preserved for debugging
              {clonePath && <> at <code className="bg-page px-1 py-0.5 rounded text-text-primary">{clonePath}</code></>}
            </p>
            {cleanupError && <p className="text-xs text-status-red-fg mt-1">{cleanupError}</p>}
          </div>
          <button
            onClick={handleCleanup}
            disabled={cleaning}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-600 text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {cleaning ? "Cleaning..." : "Cleanup"}
          </button>
        </div>
        <WorkspaceGoalLog goalSummaries={goalSummaries} />
      </div>
    )
  }

  // State 2: Active
  const repoName = run.config.repoUrl.split("/").pop() ?? run.config.repoUrl
  const activeGoalCount = goalSummaries.filter((g) =>
    g.status === "active" || g.status === "in_progress"
  ).length

  return (
    <div className="space-y-4">
      {/* Info bar */}
      <div className="rounded-lg border border-border bg-card p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="h-2.5 w-2.5 rounded-full bg-status-green-fg animate-pulse" />
          <span className="text-base font-medium text-text-primary">{repoName}</span>
          {run.projectConfig && (
            <StatusBadge status={run.projectConfig.language} />
          )}
        </div>
        <div className="flex items-center gap-3">
          {stopError && (
            <span className="text-xs text-status-red-fg">{stopError}</span>
          )}
          <button
            onClick={handleStop}
            disabled={stopping}
            className="px-3 py-1.5 rounded-md text-xs font-medium bg-red-900 text-red-300 hover:bg-red-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {stopping ? "Stopping..." : "Stop Workspace"}
          </button>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-lg border border-border bg-card p-4">
          <MetricValue label="Goals Run" value={goalSummaries.length} />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <MetricValue label="Active" value={activeGoalCount} />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <MetricValue label="Total Cost" value={costUsd} format="currency" />
        </div>
        <div className="rounded-lg border border-border bg-card p-4">
          <span className="text-xs uppercase tracking-wider text-text-secondary">Uptime</span>
          <p className="font-mono text-2xl font-bold text-text-primary mt-1">
            {formatElapsed(run.startedAt)}
          </p>
        </div>
      </div>

      {/* Goal log */}
      <WorkspaceGoalLog goalSummaries={goalSummaries} />
    </div>
  )
}
