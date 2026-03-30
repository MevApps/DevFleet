import { create } from "zustand"

type ViewMode = "stream" | "kanban" | "table"
type ActiveSection = "floor" | "new-goal" | "settings" | "analytics" | "health"

const SECTION_KEY = "devfleet-active-section"
const VALID_SECTIONS = new Set<ActiveSection>(["floor", "new-goal", "settings", "analytics", "health"])

function hasLocalStorage(): boolean {
  try { return typeof window !== "undefined" && typeof localStorage.getItem === "function" }
  catch { return false }
}

function persistSection(section: ActiveSection): void {
  if (hasLocalStorage()) localStorage.setItem(SECTION_KEY, section)
}

function loadSection(): ActiveSection {
  if (!hasLocalStorage()) return "new-goal"
  const saved = localStorage.getItem(SECTION_KEY) as ActiveSection | null
  return saved && VALID_SECTIONS.has(saved) ? saved : "new-goal"
}

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
  activeSection: loadSection(),
  setViewMode: (viewMode) => set({ viewMode }),
  focusGoal: (goalId) => {
    persistSection("floor")
    set({ focusedGoalId: goalId, activeSection: "floor" })
  },
  unfocusGoal: () => set({ focusedGoalId: null }),
  setKanbanGoalFilter: (goalId) => set({ kanbanGoalFilter: goalId }),
  toggleGoalExpanded: (goalId) =>
    set((state) => {
      const next = new Set(state.expandedGoalIds)
      if (next.has(goalId)) next.delete(goalId)
      else next.add(goalId)
      return { expandedGoalIds: next }
    }),
  setActiveSection: (activeSection) => {
    persistSection(activeSection)
    set({ activeSection, focusedGoalId: null })
  },
}))
