import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { GoalInspector } from "../goal-inspector"
import { useDashboardStore } from "@/lib/store"
import type { GoalDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 100000, maxCostUsd: 10, remaining: 5 })
const makeGoal = (overrides?: Partial<GoalDTO>): GoalDTO => ({
  id: "g-1", description: "Add OAuth2 support", status: "active",
  createdAt: "2026-03-29T10:00:00Z", completedAt: null,
  taskCount: 4, totalBudget: makeBudget(), ...overrides,
})

describe("GoalInspector", () => {
  beforeEach(() => {
    useDashboardStore.setState({
      goals: [makeGoal()],
      activeTasks: [],
      recentEvents: [],
    })
  })

  it("renders goal description", () => {
    render(<GoalInspector entityId="g-1" />)
    expect(screen.getByText("Add OAuth2 support")).toBeInTheDocument()
  })

  it("renders status badge", () => {
    render(<GoalInspector entityId="g-1" />)
    expect(screen.getByText("active")).toBeInTheDocument()
  })

  it("renders budget info", () => {
    render(<GoalInspector entityId="g-1" />)
    expect(screen.getByText(/\$5\.00/)).toBeInTheDocument()
  })

  it("shows not found for missing goal", () => {
    render(<GoalInspector entityId="nonexistent" />)
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })
})
