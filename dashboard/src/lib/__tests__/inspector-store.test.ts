import { describe, it, expect, beforeEach } from "vitest"
import { useInspectorStore } from "../inspector-store"

describe("useInspectorStore", () => {
  beforeEach(() => {
    useInspectorStore.setState({
      selectedEntityId: null,
      selectedEntityType: null,
      pinned: false,
      breadcrumbs: [],
    })
  })

  it("starts closed with no selection", () => {
    const state = useInspectorStore.getState()
    expect(state.selectedEntityId).toBeNull()
    expect(state.selectedEntityType).toBeNull()
    expect(state.pinned).toBe(false)
    expect(state.breadcrumbs).toEqual([])
  })

  it("open sets entity and pushes breadcrumb", () => {
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    const state = useInspectorStore.getState()
    expect(state.selectedEntityId).toBe("task-1")
    expect(state.selectedEntityType).toBe("task")
    expect(state.breadcrumbs).toEqual([
      { id: "task-1", type: "task", label: "Write handler" },
    ])
  })

  it("open appends to breadcrumbs when navigating deeper", () => {
    useInspectorStore.getState().open("goal-1", "goal", "OAuth2")
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    expect(useInspectorStore.getState().breadcrumbs).toHaveLength(2)
    expect(useInspectorStore.getState().breadcrumbs[0].id).toBe("goal-1")
    expect(useInspectorStore.getState().breadcrumbs[1].id).toBe("task-1")
  })

  it("close resets selection but preserves pinned state", () => {
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    useInspectorStore.getState().togglePin()
    useInspectorStore.getState().close()
    const state = useInspectorStore.getState()
    expect(state.selectedEntityId).toBeNull()
    expect(state.pinned).toBe(true)
    expect(state.breadcrumbs).toEqual([])
  })

  it("togglePin flips pinned state", () => {
    expect(useInspectorStore.getState().pinned).toBe(false)
    useInspectorStore.getState().togglePin()
    expect(useInspectorStore.getState().pinned).toBe(true)
    useInspectorStore.getState().togglePin()
    expect(useInspectorStore.getState().pinned).toBe(false)
  })

  it("navigateBreadcrumb truncates breadcrumbs and selects entity", () => {
    useInspectorStore.getState().open("goal-1", "goal", "OAuth2")
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    useInspectorStore.getState().open("agent-1", "agent", "dev-03")
    useInspectorStore.getState().navigateBreadcrumb(0)
    const state = useInspectorStore.getState()
    expect(state.selectedEntityId).toBe("goal-1")
    expect(state.selectedEntityType).toBe("goal")
    expect(state.breadcrumbs).toHaveLength(1)
  })

  it("selectedEntityId is null when closed, set when open", () => {
    expect(useInspectorStore.getState().selectedEntityId).toBeNull()
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    expect(useInspectorStore.getState().selectedEntityId).toBe("task-1")
  })
})
