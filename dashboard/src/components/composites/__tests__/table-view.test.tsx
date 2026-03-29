// src/components/composites/__tests__/table-view.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { TableView } from "../table-view"
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

describe("TableView", () => {
  beforeEach(() => {
    useDashboardStore.setState({
      goals: [makeGoal()],
      allTasks: [
        makeTask({ id: "t-1", description: "Write OAuth handler" }),
        makeTask({ id: "t-2", description: "Write tests", status: "completed" }),
      ],
    })
  })

  it("renders table headers", () => {
    render(<TableView />)
    expect(screen.getByText("Task")).toBeInTheDocument()
    expect(screen.getByText("Goal")).toBeInTheDocument()
    expect(screen.getByText("Phase")).toBeInTheDocument()
    expect(screen.getByText("Status")).toBeInTheDocument()
    expect(screen.getByText("Agent")).toBeInTheDocument()
  })

  it("renders task rows", () => {
    render(<TableView />)
    expect(screen.getByText("Write OAuth handler")).toBeInTheDocument()
    expect(screen.getByText("Write tests")).toBeInTheDocument()
  })

  it("renders checkboxes for selection", () => {
    render(<TableView />)
    const checkboxes = screen.getAllByRole("checkbox")
    expect(checkboxes.length).toBeGreaterThanOrEqual(2) // rows + header
  })

  it("shows empty state when no tasks", () => {
    useDashboardStore.setState({ allTasks: [] })
    render(<TableView />)
    expect(screen.getByText(/no tasks/i)).toBeInTheDocument()
  })
})
