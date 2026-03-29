// src/components/composites/active-floor.tsx
"use client"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import { GoalRow } from "./goal-row"
import { GoalFocusView } from "./goal-focus-view"
import { ViewModeToggle } from "./view-mode-toggle"
import { EmptyState } from "@/components/primitives/empty-state"
import { KanbanView } from "./kanban-view"
import { TableView } from "./table-view"
import { SecondaryViewWrapper } from "./secondary-view-wrapper"

// Secondary view pages — direct imports (small components, no lazy overhead needed)
import FinancialsPage from "@/app/financials/page"
import QualityPage from "@/app/quality/page"
import PerformancePage from "@/app/analytics/performance/page"
import InsightsPage from "@/app/insights/page"
import SystemPage from "@/app/system/page"
import { WorkspaceSetupForm } from "./workspace-setup-form"

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

  // Table view — dense spreadsheet with sorting, filtering, bulk actions
  if (activeSection === "floor" && viewMode === "table") {
    return (
      <div>
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-[16px] font-bold text-text-primary">Active Floor</h1>
          <ViewModeToggle />
        </div>
        <TableView />
      </div>
    )
  }

  // Secondary views from sidebar feature links
  if (activeSection === "analytics") {
    return (
      <SecondaryViewWrapper title="Analytics">
        <div className="space-y-6">
          <FinancialsPage />
          <QualityPage />
          <PerformancePage />
          <InsightsPage />
        </div>
      </SecondaryViewWrapper>
    )
  }

  if (activeSection === "health") {
    return (
      <SecondaryViewWrapper title="System Health">
        <SystemPage />
      </SecondaryViewWrapper>
    )
  }

  if (activeSection === "settings") {
    return (
      <SecondaryViewWrapper title="Workspace Settings">
        <WorkspaceSetupForm />
      </SecondaryViewWrapper>
    )
  }

  return null
}
