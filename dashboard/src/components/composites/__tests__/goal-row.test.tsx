// src/components/composites/__tests__/goal-row.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { GoalRow } from "../goal-row"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import type { GoalDTO, TaskDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 100000, maxCostUsd: 10, remaining: 5 })

const makeGoal = (overrides?: Partial<GoalDTO>): GoalDTO => ({
  id: "g-1", description: "Add OAuth2 support", status: "active",
  createdAt: "2026-03-29T10:00:00Z", completedAt: null,
  taskCount: 4, totalBudget: makeBudget(), ...overrides,
})

describe("GoalRow", () => {
  beforeEach(() => {
    useFloorStore.setState({ expandedGoalIds: new Set() })
    useDashboardStore.setState({ activeTasks: [] })
  })

  it("renders goal description", () => {
    render(<GoalRow goal={makeGoal()} />)
    expect(screen.getByText("Add OAuth2 support")).toBeInTheDocument()
  })

  it("renders task count", () => {
    render(<GoalRow goal={makeGoal({ taskCount: 6 })} />)
    expect(screen.getByText(/0\/6/)).toBeInTheDocument()
  })

  it("renders status badge", () => {
    render(<GoalRow goal={makeGoal({ status: "active" })} />)
    expect(screen.getByText("active")).toBeInTheDocument()
  })

  it("shows amber border for blocked goals", () => {
    const { container } = render(<GoalRow goal={makeGoal({ status: "blocked" })} />)
    const row = container.firstChild as HTMLElement
    expect(row.className).toContain("border-l-3")
  })
})
