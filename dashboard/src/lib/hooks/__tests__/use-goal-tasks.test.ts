// src/lib/hooks/__tests__/use-goal-tasks.test.ts
import { describe, it, expect, beforeEach } from "vitest"
import { useDashboardStore } from "@/lib/store"
import { getGoalTasks, computePhaseSegments, computeTaskProgress, getTaskDisplayPhase } from "../use-goal-tasks"
import type { TaskDTO, GoalDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 10000, maxCostUsd: 1, remaining: 0.5 })

const makeTask = (overrides: Partial<TaskDTO>): TaskDTO => ({
  id: "t-1", goalId: "g-1", description: "Test task", status: "in_progress",
  phase: "implementation", assignedTo: "dev-01", tokensUsed: 500,
  budget: makeBudget(), retryCount: 0, branch: null, ...overrides,
})

describe("getGoalTasks", () => {
  it("filters tasks by goalId", () => {
    const tasks: readonly TaskDTO[] = [
      makeTask({ id: "t-1", goalId: "g-1" }),
      makeTask({ id: "t-2", goalId: "g-2" }),
      makeTask({ id: "t-3", goalId: "g-1" }),
    ]
    const result = getGoalTasks(tasks, "g-1")
    expect(result).toHaveLength(2)
    expect(result.map(t => t.id)).toEqual(["t-1", "t-3"])
  })

  it("returns empty array when no tasks match", () => {
    const tasks: readonly TaskDTO[] = [makeTask({ goalId: "g-2" })]
    expect(getGoalTasks(tasks, "g-1")).toEqual([])
  })
})

describe("computePhaseSegments", () => {
  it("computes segment widths from task statuses", () => {
    const tasks: readonly TaskDTO[] = [
      makeTask({ status: "completed", phase: "planning" }),
      makeTask({ status: "in_progress", phase: "implementation" }),
      makeTask({ status: "review", phase: "review" }),
      makeTask({ status: "queued", phase: "implementation" }),
    ]
    const segments = computePhaseSegments(tasks)
    expect(segments).toEqual([
      { type: "done", percent: 25 },
      { type: "active", percent: 25 },
      { type: "review", percent: 25 },
      { type: "queued", percent: 25 },
    ])
  })

  it("returns empty array for no tasks", () => {
    expect(computePhaseSegments([])).toEqual([])
  })

  it("handles all completed tasks", () => {
    const tasks: readonly TaskDTO[] = [
      makeTask({ status: "completed" }),
      makeTask({ status: "merged" }),
    ]
    const segments = computePhaseSegments(tasks)
    expect(segments).toEqual([{ type: "done", percent: 100 }])
  })
})

describe("getTaskDisplayPhase", () => {
  it("maps completed/merged to done", () => {
    expect(getTaskDisplayPhase(makeTask({ status: "completed" }))).toBe("done")
    expect(getTaskDisplayPhase(makeTask({ status: "merged" }))).toBe("done")
  })

  it("maps review statuses to review", () => {
    expect(getTaskDisplayPhase(makeTask({ status: "review" }))).toBe("review")
    expect(getTaskDisplayPhase(makeTask({ status: "pending_review" }))).toBe("review")
  })

  it("uses task.phase for active/queued statuses", () => {
    expect(getTaskDisplayPhase(makeTask({ status: "in_progress", phase: "planning" }))).toBe("planning")
    expect(getTaskDisplayPhase(makeTask({ status: "queued", phase: "implementation" }))).toBe("implementation")
  })
})

describe("computeTaskProgress", () => {
  it("counts completed and total tasks", () => {
    const tasks: readonly TaskDTO[] = [
      makeTask({ status: "completed" }),
      makeTask({ status: "merged" }),
      makeTask({ status: "in_progress" }),
      makeTask({ status: "queued" }),
    ]
    const progress = computeTaskProgress(tasks, 4)
    expect(progress).toEqual({ done: 2, total: 4 })
  })

  it("uses goalTaskCount when larger than tasks array", () => {
    const tasks: readonly TaskDTO[] = [
      makeTask({ status: "completed" }),
    ]
    const progress = computeTaskProgress(tasks, 5)
    expect(progress).toEqual({ done: 1, total: 5 })
  })
})
