// src/components/composites/__tests__/kanban-view.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { KanbanView } from "../kanban-view"
import { useFloorStore } from "@/lib/floor-store"
import { useDashboardStore } from "@/lib/store"
import type { TaskDTO, GoalDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 10000, maxCostUsd: 1, remaining: 0.5 })
const makeGoal = (overrides?: Partial<GoalDTO>): GoalDTO => ({
  id: "g-1", description: "OAuth2", status: "active",
  createdAt: "2026-03-29T10:00:00Z", completedAt: null,
  taskCount: 2, totalBudget: makeBudget(), ...overrides,
})
const makeTask = (overrides?: Partial<TaskDTO>): TaskDTO => ({
  id: "t-1", goalId: "g-1", description: "Write handler", status: "in_progress",
  phase: "implementation", assignedTo: "dev-01", tokensUsed: 500,
  budget: makeBudget(), retryCount: 0, branch: null, ...overrides,
})

describe("KanbanView", () => {
  beforeEach(() => {
    useFloorStore.setState({ kanbanGoalFilter: null })
    useDashboardStore.setState({
      goals: [makeGoal()],
      activeTasks: [
        makeTask({ id: "t-1", status: "in_progress", phase: "implementation" }),
        makeTask({ id: "t-2", status: "completed", phase: "implementation" }),
      ],
    })
  })

  it("renders four phase columns", () => {
    render(<KanbanView />)
    expect(screen.getByText("Planning")).toBeInTheDocument()
    expect(screen.getByText("Implementation")).toBeInTheDocument()
    expect(screen.getByText("Review")).toBeInTheDocument()
    expect(screen.getByText("Done")).toBeInTheDocument()
  })

  it("renders filter bar", () => {
    render(<KanbanView />)
    expect(screen.getByText("All Goals")).toBeInTheDocument()
  })

  it("renders task descriptions", () => {
    render(<KanbanView />)
    expect(screen.getAllByText(/Write handler/).length).toBeGreaterThan(0)
  })

  it("filters tasks when goal filter is set", () => {
    useDashboardStore.setState({
      goals: [
        makeGoal({ id: "g-1", description: "OAuth2" }),
        makeGoal({ id: "g-2", description: "Redis" }),
      ],
      activeTasks: [
        makeTask({ id: "t-1", goalId: "g-1", description: "OAuth task" }),
        makeTask({ id: "t-2", goalId: "g-2", description: "Redis task" }),
      ],
    })
    useFloorStore.setState({ kanbanGoalFilter: "g-1" })
    render(<KanbanView />)
    expect(screen.getByText(/OAuth task/)).toBeInTheDocument()
    expect(screen.queryByText(/Redis task/)).not.toBeInTheDocument()
  })
})
