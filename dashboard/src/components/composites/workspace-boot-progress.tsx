import type { WorkspaceRunStatus } from "@/lib/types"
import { cn } from "@/lib/utils"
import { formatElapsed } from "@/lib/utils/format"

const BOOT_PHASES = [
  { status: "cloning" as const, label: "Cloning" },
  { status: "installing" as const, label: "Installing" },
  { status: "detecting" as const, label: "Detecting" },
  { status: "active" as const, label: "Active" },
]

interface WorkspaceBootProgressProps {
  status: WorkspaceRunStatus
  repoUrl: string
  startedAt: string
}

export function WorkspaceBootProgress({ status, repoUrl, startedAt }: WorkspaceBootProgressProps) {
  const currentIndex = BOOT_PHASES.findIndex((p) => p.status === status)

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="w-full max-w-lg text-center">
        <p className="text-3xl mb-4">⏳</p>
        <h2 className="text-lg font-semibold text-text-primary mb-1">Setting up workspace</h2>
        <p className="text-sm text-text-secondary mb-6">{repoUrl}</p>

        <div className="flex items-center justify-center gap-2 mb-6">
          {BOOT_PHASES.map((phase, i) => {
            const isComplete = i < currentIndex
            const isCurrent = i === currentIndex
            return (
              <div key={phase.status} className="flex items-center gap-2">
                <div className="flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border",
                      isComplete && "bg-status-green-surface border-status-green-border text-status-green-fg",
                      isCurrent && "bg-status-blue-surface border-status-blue-border text-status-blue-fg",
                      !isComplete && !isCurrent && "bg-page border-border text-text-muted",
                    )}
                  >
                    {isComplete ? "✓" : i + 1}
                  </div>
                  <span
                    className={cn(
                      "text-xs",
                      isCurrent ? "text-status-blue-fg font-medium" : "text-text-muted",
                    )}
                  >
                    {phase.label}
                  </span>
                </div>
                {i < BOOT_PHASES.length - 1 && (
                  <div
                    className={cn(
                      "w-8 h-px mb-4",
                      i < currentIndex ? "bg-status-green-fg" : "bg-border",
                    )}
                  />
                )}
              </div>
            )
          })}
        </div>

        <p className="text-xs text-text-muted">Elapsed: {formatElapsed(startedAt)}</p>
      </div>
    </div>
  )
}
