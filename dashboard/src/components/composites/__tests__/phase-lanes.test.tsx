// src/components/composites/__tests__/phase-lanes.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { PhaseLanes } from "../phase-lanes"
import type { TaskDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 10000, maxCostUsd: 1, remaining: 0.5 })
const makeTask = (overrides: Partial<TaskDTO>): TaskDTO => ({
  id: "t-1", goalId: "g-1", description: "Test task", status: "in_progress",
  phase: "implementation", assignedTo: "dev-01", tokensUsed: 500,
  budget: makeBudget(), retryCount: 0, branch: null, ...overrides,
})

describe("PhaseLanes", () => {
  it("renders four phase columns", () => {
    render(<PhaseLanes tasks={[]} onTaskClick={() => {}} />)
    expect(screen.getByText("Planning")).toBeInTheDocument()
    expect(screen.getByText("Implementation")).toBeInTheDocument()
    expect(screen.getByText("Review")).toBeInTheDocument()
    expect(screen.getByText("Done")).toBeInTheDocument()
  })

  it("places completed tasks in Done column", () => {
    const tasks = [makeTask({ id: "t-1", status: "completed", description: "Write spec" })]
    render(<PhaseLanes tasks={tasks} onTaskClick={() => {}} />)
    expect(screen.getByText(/Write spec/)).toBeInTheDocument()
  })

  it("places review tasks in Review column", () => {
    const tasks = [makeTask({ id: "t-1", status: "review", description: "Review handler" })]
    render(<PhaseLanes tasks={tasks} onTaskClick={() => {}} />)
    expect(screen.getByText(/Review handler/)).toBeInTheDocument()
  })

  it("shows 'No tasks' for empty phases", () => {
    render(<PhaseLanes tasks={[]} onTaskClick={() => {}} />)
    const noTasks = screen.getAllByText("No tasks")
    expect(noTasks).toHaveLength(4)
  })
})
