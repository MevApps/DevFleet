"use client"
import { useInspectorStore } from "@/lib/inspector-store"
import { cn } from "@/lib/utils"
import { X, Pin } from "lucide-react"
import { getInspectorComponent } from "@/components/inspector/inspector-registry"

export function InspectorPanel() {
  const selectedEntityId = useInspectorStore((s) => s.selectedEntityId)
  const selectedEntityType = useInspectorStore((s) => s.selectedEntityType)
  const pinned = useInspectorStore((s) => s.pinned)
  const breadcrumbs = useInspectorStore((s) => s.breadcrumbs)
  const close = useInspectorStore((s) => s.close)
  const togglePin = useInspectorStore((s) => s.togglePin)
  const navigateBreadcrumb = useInspectorStore((s) => s.navigateBreadcrumb)

  if (!selectedEntityId) return null

  return (
    <div
      data-testid="inspector"
      className="flex flex-col border-l border-border bg-bg-card shrink-0 overflow-y-auto"
      style={{ width: "var(--inspector-width)" }}
    >
      {/* Accent bar */}
      <div className="h-[3px] bg-status-purple-fg" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-text-muted">
          {selectedEntityType}
        </span>
        <div className="flex items-center gap-1.5">
          <button
            onClick={togglePin}
            className={cn(
              "p-1 rounded-md",
              pinned ? "text-status-purple-fg bg-status-purple-surface" : "text-text-muted hover:bg-bg-hover",
            )}
            aria-label={pinned ? "Unpin inspector" : "Pin inspector"}
          >
            <Pin size={14} />
          </button>
          <button
            onClick={close}
            className="p-1 rounded-md text-text-muted hover:bg-bg-hover"
            aria-label="Close inspector"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Breadcrumbs */}
      {breadcrumbs.length > 1 && (
        <div className="flex items-center gap-1 px-4 py-2 text-[11px] text-text-muted border-b border-border overflow-x-auto">
          {breadcrumbs.map((crumb, i) => (
            <span key={`${i}-${crumb.id}`} className="flex items-center gap-1 whitespace-nowrap">
              {i > 0 && <span className="text-text-muted">&gt;</span>}
              <button
                onClick={() => navigateBreadcrumb(i)}
                className={cn(
                  "hover:text-text-primary transition-colors",
                  i === breadcrumbs.length - 1 ? "text-text-primary font-medium" : "text-text-muted",
                )}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Body — type-specific inspector */}
      <div className="flex-1 p-4">
        {(() => {
          const InspectorComponent = selectedEntityType ? getInspectorComponent(selectedEntityType) : null
          if (!InspectorComponent) {
            return <p className="text-sm text-text-muted">Unknown entity type.</p>
          }
          return <InspectorComponent entityId={selectedEntityId} />
        })()}
      </div>
    </div>
  )
}
