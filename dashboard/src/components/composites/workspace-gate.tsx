"use client"
import { useWorkspaceStore } from "@/lib/workspace-store"
import { WorkspaceSetupForm } from "./workspace-setup-form"
import { WorkspaceBootProgress } from "./workspace-boot-progress"

const BOOT_STATUSES = new Set(["created", "cloning", "installing", "detecting"])

interface WorkspaceGateProps {
  children: () => React.ReactNode
}

export function WorkspaceGate({ children }: WorkspaceGateProps) {
  const run = useWorkspaceStore((s) => s.run)
  const status = run?.status

  // No workspace or stopped
  if (!run || status === "stopped") {
    return (
      <div className="flex items-center justify-center h-full">
        <WorkspaceSetupForm />
      </div>
    )
  }

  // Failed
  if (status === "failed") {
    return (
      <div className="flex items-center justify-center h-full">
        <WorkspaceSetupForm errorMessage={run.error} />
      </div>
    )
  }

  // Booting
  if (status && BOOT_STATUSES.has(status)) {
    return (
      <div className="flex items-center justify-center h-full">
        <WorkspaceBootProgress
          status={status}
          repoUrl={run.config.repoUrl}
          startedAt={run.startedAt}
        />
      </div>
    )
  }

  // Active (or stopped_dirty — let children handle)
  return <>{children()}</>
}
