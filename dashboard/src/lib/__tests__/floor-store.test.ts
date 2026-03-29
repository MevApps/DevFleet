import { describe, it, expect, beforeEach } from "vitest"
import { useFloorStore } from "../floor-store"

describe("useFloorStore", () => {
  beforeEach(() => {
    useFloorStore.setState({
      viewMode: "stream",
      focusedGoalId: null,
      kanbanGoalFilter: null,
      expandedGoalIds: new Set(),
      activeSection: "floor",
    })
  })

  it("starts with default state", () => {
    const state = useFloorStore.getState()
    expect(state.viewMode).toBe("stream")
    expect(state.focusedGoalId).toBeNull()
    expect(state.kanbanGoalFilter).toBeNull()
    expect(state.expandedGoalIds.size).toBe(0)
    expect(state.activeSection).toBe("floor")
  })

  it("setViewMode changes view mode", () => {
    useFloorStore.getState().setViewMode("kanban")
    expect(useFloorStore.getState().viewMode).toBe("kanban")
  })

  it("focusGoal sets focusedGoalId and activeSection to floor", () => {
    useFloorStore.getState().setActiveSection("analytics")
    useFloorStore.getState().focusGoal("goal-1")
    const state = useFloorStore.getState()
    expect(state.focusedGoalId).toBe("goal-1")
    expect(state.activeSection).toBe("floor")
  })

  it("unfocusGoal clears focusedGoalId", () => {
    useFloorStore.getState().focusGoal("goal-1")
    useFloorStore.getState().unfocusGoal()
    expect(useFloorStore.getState().focusedGoalId).toBeNull()
  })

  it("toggleGoalExpanded adds and removes goal IDs", () => {
    useFloorStore.getState().toggleGoalExpanded("g-1")
    expect(useFloorStore.getState().expandedGoalIds.has("g-1")).toBe(true)
    useFloorStore.getState().toggleGoalExpanded("g-1")
    expect(useFloorStore.getState().expandedGoalIds.has("g-1")).toBe(false)
  })

  it("setActiveSection preserves viewMode", () => {
    useFloorStore.getState().setViewMode("kanban")
    useFloorStore.getState().setActiveSection("analytics")
    expect(useFloorStore.getState().viewMode).toBe("kanban")
    expect(useFloorStore.getState().activeSection).toBe("analytics")
  })

  it("setActiveSection clears focusedGoalId", () => {
    useFloorStore.getState().focusGoal("goal-1")
    useFloorStore.getState().setActiveSection("analytics")
    expect(useFloorStore.getState().focusedGoalId).toBeNull()
  })
})
