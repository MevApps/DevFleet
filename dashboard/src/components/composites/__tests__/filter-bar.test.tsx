// src/components/composites/__tests__/filter-bar.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { FilterBar } from "../filter-bar"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import type { GoalDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 100000, maxCostUsd: 10, remaining: 5 })
const makeGoal = (overrides?: Partial<GoalDTO>): GoalDTO => ({
  id: "g-1", description: "Add OAuth2", status: "active",
  createdAt: "2026-03-29T10:00:00Z", completedAt: null,
  taskCount: 4, totalBudget: makeBudget(), ...overrides,
})

describe("FilterBar", () => {
  beforeEach(() => {
    useFloorStore.setState({ kanbanGoalFilter: null })
    useDashboardStore.setState({ goals: [
      makeGoal({ id: "g-1", description: "OAuth2" }),
      makeGoal({ id: "g-2", description: "Redis sessions" }),
    ]})
  })

  it("renders All Goals chip", () => {
    render(<FilterBar />)
    expect(screen.getByText("All Goals")).toBeInTheDocument()
  })

  it("renders a chip per goal", () => {
    render(<FilterBar />)
    expect(screen.getByText(/OAuth2/)).toBeInTheDocument()
    expect(screen.getByText(/Redis/)).toBeInTheDocument()
  })

  it("highlights All Goals when no filter active", () => {
    render(<FilterBar />)
    const allBtn = screen.getByText("All Goals")
    expect(allBtn.className).toContain("bg-text-primary")
  })

  it("renders nothing when no goals", () => {
    useDashboardStore.setState({ goals: [] })
    const { container } = render(<FilterBar />)
    expect(container.querySelector("[data-testid='filter-bar']")).toBeNull()
  })
})
