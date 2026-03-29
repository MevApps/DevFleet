// src/components/composites/__tests__/goal-focus-view.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { GoalFocusView } from "../goal-focus-view"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import type { GoalDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 100000, maxCostUsd: 10, remaining: 5 })
const makeGoal = (overrides?: Partial<GoalDTO>): GoalDTO => ({
  id: "g-1", description: "Add OAuth2 support for GitHub and Google", status: "active",
  createdAt: "2026-03-29T10:00:00Z", completedAt: null,
  taskCount: 6, totalBudget: makeBudget(), ...overrides,
})

describe("GoalFocusView", () => {
  beforeEach(() => {
    useDashboardStore.setState({
      goals: [makeGoal()],
      allTasks: [],
      agents: [],
    })
    useFloorStore.setState({ focusedGoalId: "g-1" })
  })

  it("renders goal title", () => {
    render(<GoalFocusView />)
    expect(screen.getByText("Add OAuth2 support for GitHub and Google")).toBeInTheDocument()
  })

  it("renders back button", () => {
    render(<GoalFocusView />)
    expect(screen.getByLabelText(/back/i)).toBeInTheDocument()
  })

  it("renders stat cards", () => {
    render(<GoalFocusView />)
    expect(screen.getByText("Tasks")).toBeInTheDocument()
    expect(screen.getByText("Budget")).toBeInTheDocument()
  })

  it("renders Tasks by Phase label", () => {
    render(<GoalFocusView />)
    expect(screen.getByText("Tasks by Phase")).toBeInTheDocument()
  })

  it("renders nothing when focusedGoalId has no matching goal", () => {
    useFloorStore.setState({ focusedGoalId: "nonexistent" })
    const { container } = render(<GoalFocusView />)
    expect(container.textContent).toContain("not found")
  })
})
