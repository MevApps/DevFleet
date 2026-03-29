// src/components/layout/__tests__/inspector-panel.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { InspectorPanel } from "../inspector-panel"
import { useInspectorStore } from "@/lib/inspector-store"
import { useDashboardStore } from "@/lib/store"

describe("InspectorPanel", () => {
  beforeEach(() => {
    useInspectorStore.setState({
      selectedEntityId: null,
      selectedEntityType: null,
      pinned: false,
      breadcrumbs: [],
    })
  })

  it("renders nothing when no entity is selected", () => {
    const { container } = render(<InspectorPanel />)
    expect(container.querySelector("[data-testid='inspector']")).toBeNull()
  })

  it("renders panel when entity is selected", () => {
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    render(<InspectorPanel />)
    expect(screen.getByTestId("inspector")).toBeInTheDocument()
  })

  it("shows entity type in header", () => {
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    render(<InspectorPanel />)
    expect(screen.getByText("task")).toBeInTheDocument()
  })

  it("shows close button", () => {
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    render(<InspectorPanel />)
    expect(screen.getByLabelText(/close/i)).toBeInTheDocument()
  })

  it("shows pin button", () => {
    useInspectorStore.getState().open("task-1", "task", "Write handler")
    render(<InspectorPanel />)
    expect(screen.getByLabelText(/pin/i)).toBeInTheDocument()
  })

  it("renders goal inspector content for goal entity", () => {
    useDashboardStore.setState({
      goals: [{ id: "g-1", description: "Test goal", status: "active", createdAt: "2026-03-29T10:00:00Z", completedAt: null, taskCount: 2, totalBudget: { maxTokens: 100000, maxCostUsd: 10, remaining: 5 } }],
      allTasks: [],
      recentEvents: [],
    })
    useInspectorStore.getState().open("g-1", "goal", "Test goal")
    render(<InspectorPanel />)
    expect(screen.getByText("Test goal")).toBeInTheDocument()
  })
})
