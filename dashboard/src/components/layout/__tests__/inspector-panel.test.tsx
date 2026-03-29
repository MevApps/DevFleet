// src/components/layout/__tests__/inspector-panel.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { InspectorPanel } from "../inspector-panel"
import { useInspectorStore } from "@/lib/inspector-store"

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
    expect(screen.getByText(/task/i)).toBeInTheDocument()
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
})
