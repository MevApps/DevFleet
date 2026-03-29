// src/components/composites/view-mode-toggle.tsx
"use client"
import { useFloorStore } from "@/lib/floor-store"
import { cn } from "@/lib/utils"

const VIEW_MODES = [
  { value: "stream" as const, label: "Stream" },
  { value: "kanban" as const, label: "Kanban" },
  { value: "table" as const, label: "Table" },
]

export function ViewModeToggle() {
  const viewMode = useFloorStore((s) => s.viewMode)
  const setViewMode = useFloorStore((s) => s.setViewMode)

  return (
    <div className="flex rounded-lg overflow-hidden border border-border">
      {VIEW_MODES.map((mode) => (
        <button
          key={mode.value}
          onClick={() => setViewMode(mode.value)}
          className={cn(
            "px-3.5 py-1 text-[12px] font-medium transition-colors",
            viewMode === mode.value
              ? "bg-text-primary text-text-inverse"
              : "bg-bg-card text-text-muted hover:text-text-secondary",
          )}
        >
          {mode.label}
        </button>
      ))}
    </div>
  )
}
