// src/components/composites/__tests__/active-floor.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { ActiveFloor } from "../active-floor"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import type { GoalDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 100000, maxCostUsd: 10, remaining: 5 })
const makeGoal = (overrides?: Partial<GoalDTO>): GoalDTO => ({
  id: "g-1", description: "Add OAuth2", status: "active",
  createdAt: "2026-03-29T10:00:00Z", completedAt: null,
  taskCount: 4, totalBudget: makeBudget(), ...overrides,
})

describe("ActiveFloor", () => {
  beforeEach(() => {
    useFloorStore.setState({ viewMode: "stream", focusedGoalId: null, activeSection: "floor" })
    useDashboardStore.setState({ goals: [], allTasks: [], agents: [] })
  })

  it("renders Stream view with view mode toggle", () => {
    render(<ActiveFloor />)
    expect(screen.getByText("Stream")).toBeInTheDocument()
    expect(screen.getByText("Active Floor")).toBeInTheDocument()
  })

  it("shows empty state when no goals exist", () => {
    render(<ActiveFloor />)
    expect(screen.getByText(/no goals yet/i)).toBeInTheDocument()
  })

  it("renders goal rows when goals exist", () => {
    useDashboardStore.setState({ goals: [makeGoal()] })
    render(<ActiveFloor />)
    expect(screen.getByText("Add OAuth2")).toBeInTheDocument()
  })

  it("renders GoalFocusView when a goal is focused", () => {
    useDashboardStore.setState({ goals: [makeGoal()] })
    useFloorStore.setState({ focusedGoalId: "g-1" })
    render(<ActiveFloor />)
    expect(screen.getByLabelText(/back/i)).toBeInTheDocument()
  })
})
