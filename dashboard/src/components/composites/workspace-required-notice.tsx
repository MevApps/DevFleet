import Link from "next/link"

export function WorkspaceRequiredNotice() {
  return (
    <div className="rounded-lg border border-status-yellow-border bg-status-yellow-surface p-4 flex items-center gap-3">
      <span className="text-status-yellow-fg text-sm">⚠</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-text-primary">No active workspace</p>
        <p className="text-xs text-text-secondary mt-0.5">Start a workspace to create goals.</p>
      </div>
      <Link
        href="/workspace"
        className="px-3 py-1.5 rounded-md text-xs font-medium bg-blue-600 text-white hover:bg-blue-500"
      >
        Start Workspace →
      </Link>
    </div>
  )
}
