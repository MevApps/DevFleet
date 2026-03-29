import { create } from "zustand"

type ViewMode = "stream" | "kanban" | "table"
type ActiveSection = "floor" | "settings" | "analytics" | "health"

interface FloorState {
  viewMode: ViewMode
  focusedGoalId: string | null
  kanbanGoalFilter: string | null
  expandedGoalIds: Set<string>
  activeSection: ActiveSection
  setViewMode: (mode: ViewMode) => void
  focusGoal: (goalId: string) => void
  unfocusGoal: () => void
  setKanbanGoalFilter: (goalId: string | null) => void
  toggleGoalExpanded: (goalId: string) => void
  setActiveSection: (section: ActiveSection) => void
}

export const useFloorStore = create<FloorState>((set) => ({
  viewMode: "stream",
  focusedGoalId: null,
  kanbanGoalFilter: null,
  expandedGoalIds: new Set(),
  activeSection: "floor",
  setViewMode: (viewMode) => set({ viewMode }),
  focusGoal: (goalId) => set({ focusedGoalId: goalId, activeSection: "floor" }),
  unfocusGoal: () => set({ focusedGoalId: null }),
  setKanbanGoalFilter: (goalId) => set({ kanbanGoalFilter: goalId }),
  toggleGoalExpanded: (goalId) =>
    set((state) => {
      const next = new Set(state.expandedGoalIds)
      if (next.has(goalId)) next.delete(goalId)
      else next.add(goalId)
      return { expandedGoalIds: next }
    }),
  setActiveSection: (activeSection) => set({ activeSection, focusedGoalId: null }),
}))
