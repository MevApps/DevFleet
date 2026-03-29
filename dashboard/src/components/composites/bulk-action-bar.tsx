"use client"

interface BulkActionBarProps {
  selectedCount: number
  onRetry: () => void
  onReassign: () => void
  onDiscard: () => void
  onClearSelection: () => void
}

export function BulkActionBar({ selectedCount, onRetry, onReassign, onDiscard, onClearSelection }: BulkActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 mb-3 rounded-lg border border-status-blue-border bg-status-blue-surface">
      <span className="text-[13px] font-semibold text-text-primary">
        {selectedCount} selected
      </span>
      <div className="flex gap-2 ml-auto">
        <button
          onClick={onRetry}
          className="px-3 py-1.5 rounded-md text-[12px] font-semibold bg-text-primary text-text-inverse hover:opacity-90"
        >
          Retry
        </button>
        <button
          onClick={onReassign}
          className="px-3 py-1.5 rounded-md text-[12px] font-semibold border border-border text-text-secondary hover:bg-bg-hover"
        >
          Reassign
        </button>
        <button
          onClick={onDiscard}
          className="px-3 py-1.5 rounded-md text-[12px] font-semibold border border-status-red-border text-status-red-fg hover:bg-status-red-surface"
        >
          Discard
        </button>
        <button
          onClick={onClearSelection}
          className="px-3 py-1.5 rounded-md text-[12px] font-medium border border-border text-text-muted hover:bg-bg-hover"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
