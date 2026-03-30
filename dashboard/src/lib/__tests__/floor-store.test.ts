import { describe, it, expect, beforeEach, vi } from "vitest"
import { useFloorStore } from "../floor-store"

const SECTION_KEY = "devfleet-active-section"

const storage = new Map<string, string>()
const mockLocalStorage = {
  getItem: vi.fn((key: string) => storage.get(key) ?? null),
  setItem: vi.fn((key: string, value: string) => storage.set(key, value)),
  removeItem: vi.fn((key: string) => storage.delete(key)),
  clear: vi.fn(() => storage.clear()),
  get length() { return storage.size },
  key: vi.fn(() => null),
}
Object.defineProperty(globalThis, "localStorage", { value: mockLocalStorage, writable: true })

describe("useFloorStore", () => {
  beforeEach(() => {
    storage.clear()
    vi.clearAllMocks()
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

  describe("localStorage persistence", () => {
    it("setActiveSection persists to localStorage", () => {
      useFloorStore.getState().setActiveSection("analytics")
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(SECTION_KEY, "analytics")
      expect(storage.get(SECTION_KEY)).toBe("analytics")
    })

    it("focusGoal persists 'floor' to localStorage", () => {
      useFloorStore.getState().focusGoal("goal-1")
      expect(mockLocalStorage.setItem).toHaveBeenCalledWith(SECTION_KEY, "floor")
      expect(storage.get(SECTION_KEY)).toBe("floor")
    })

    it("setActiveSection updates on each call", () => {
      useFloorStore.getState().setActiveSection("analytics")
      useFloorStore.getState().setActiveSection("health")
      expect(storage.get(SECTION_KEY)).toBe("health")
    })
  })
})
