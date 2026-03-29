// src/components/composites/active-floor.tsx
"use client"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import { GoalRow } from "./goal-row"
import { GoalFocusView } from "./goal-focus-view"
import { ViewModeToggle } from "./view-mode-toggle"
import { EmptyState } from "@/components/primitives/empty-state"
import { KanbanView } from "./kanban-view"

export function ActiveFloor() {
  const viewMode = useFloorStore((s) => s.viewMode)
  const focusedGoalId = useFloorStore((s) => s.focusedGoalId)
  const activeSection = useFloorStore((s) => s.activeSection)
  const goals = useDashboardStore((s) => s.goals)

  // Goal Focus View — when a goal is selected from the sidebar
  if (focusedGoalId && activeSection === "floor") {
    return <GoalFocusView />
  }

  // Stream view (default) — goal rows sorted by last activity
  if (activeSection === "floor" && viewMode === "stream") {
    const sortedGoals = [...goals].sort((a, b) => {
      const aTime = a.completedAt ?? a.createdAt
      const bTime = b.completedAt ?? b.createdAt
      return new Date(bTime).getTime() - new Date(aTime).getTime()
    })

    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[16px] font-bold text-text-primary">Active Floor</h1>
          <ViewModeToggle />
        </div>

        {sortedGoals.length === 0 ? (
          <EmptyState
            icon="Target"
            title="No goals yet"
            description="Create a goal from the sidebar to get started."
          />
        ) : (
          sortedGoals.map((goal) => <GoalRow key={goal.id} goal={goal} />)
        )}
      </div>
    )
  }

  // Kanban view — flat task board with goal filters
  if (activeSection === "floor" && viewMode === "kanban") {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[16px] font-bold text-text-primary">Active Floor</h1>
          <ViewModeToggle />
        </div>
        <KanbanView />
      </div>
    )
  }

  // Table view — placeholder for Phase 4b
  if (activeSection === "floor" && viewMode === "table") {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[16px] font-bold text-text-primary">Active Floor</h1>
          <ViewModeToggle />
        </div>
        <p className="text-sm text-text-muted">Table view will be implemented in Phase 4b.</p>
      </div>
    )
  }

  // Secondary sections — placeholder, Phase 5 will render existing pages here
  return (
    <div>
      <p className="text-sm text-text-muted">
        {activeSection} view will be implemented in Phase 5.
      </p>
    </div>
  )
}
