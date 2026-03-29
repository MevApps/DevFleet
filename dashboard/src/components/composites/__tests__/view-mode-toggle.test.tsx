// src/components/composites/__tests__/view-mode-toggle.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { userEvent } from "@testing-library/user-event"
import { ViewModeToggle } from "../view-mode-toggle"
import { useFloorStore } from "@/lib/floor-store"

describe("ViewModeToggle", () => {
  beforeEach(() => {
    useFloorStore.setState({ viewMode: "stream" })
  })

  it("renders three view mode buttons", () => {
    render(<ViewModeToggle />)
    expect(screen.getByText("Stream")).toBeInTheDocument()
    expect(screen.getByText("Kanban")).toBeInTheDocument()
    expect(screen.getByText("Table")).toBeInTheDocument()
  })

  it("highlights the active view mode", () => {
    render(<ViewModeToggle />)
    const streamBtn = screen.getByText("Stream")
    expect(streamBtn.className).toContain("bg-text-primary")
  })
})
