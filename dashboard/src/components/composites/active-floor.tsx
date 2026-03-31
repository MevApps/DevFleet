// src/components/composites/active-floor.tsx
"use client"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import { sortGoalsByRecency } from "@/lib/utils/format"
import { GoalRow } from "./goal-row"
import { GoalFocusView } from "./goal-focus-view"
import { ViewModeToggle } from "./view-mode-toggle"
import { EmptyState } from "@/components/primitives/empty-state"
import { KanbanView } from "./kanban-view"
import { TableView } from "./table-view"
import { SecondaryViewWrapper } from "./secondary-view-wrapper"
import { NewGoalScreen } from "./new-goal-screen"

// Secondary view pages — direct imports (small components, no lazy overhead needed)
import FinancialsPage from "@/app/financials/page"
import QualityPage from "@/app/quality/page"
import PerformancePage from "@/app/analytics/performance/page"
import InsightsPage from "@/app/insights/page"
import SystemPage from "@/app/system/page"

export function ActiveFloor() {
  const activeSection = useFloorStore((s) => s.activeSection)

  switch (activeSection) {
    case "new-goal":
      return <NewGoalScreen />
    case "analytics":
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
    case "health":
      return (
        <SecondaryViewWrapper title="System Health">
          <SystemPage />
        </SecondaryViewWrapper>
      )
    case "settings":
      return (
        <SecondaryViewWrapper title="Settings">
          <p className="text-text-muted text-sm">Settings coming soon.</p>
        </SecondaryViewWrapper>
      )
    case "floor":
      return <FloorView />
  }
}

function FloorView() {
  const viewMode = useFloorStore((s) => s.viewMode)
  const focusedGoalId = useFloorStore((s) => s.focusedGoalId)
  const goals = useDashboardStore((s) => s.goals)

  if (focusedGoalId) {
    return <GoalFocusView />
  }

  const viewContent = (() => {
    switch (viewMode) {
      case "stream": {
        const sorted = sortGoalsByRecency(goals)
        return sorted.length === 0
          ? <EmptyState icon="Target" title="No goals yet" description="Create a goal from the sidebar to get started." />
          : sorted.map((goal) => <GoalRow key={goal.id} goal={goal} />)
      }
      case "kanban":
        return <KanbanView />
      case "table":
        return <TableView />
    }
  })()

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-[16px] font-bold text-text-primary">Active Floor</h1>
        <ViewModeToggle />
      </div>
      {viewContent}
    </div>
  )
}
