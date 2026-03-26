import { createTask, canTransition, isOverBudget, type Task } from "../../src/entities/Task"
import { createTaskId, createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

const baseParams = {
  id: createTaskId("t-1"),
  goalId: createGoalId("g-1"),
  description: "Implement feature X",
  phase: "code",
  budget: createBudget({ maxTokens: 1000, maxCostUsd: 1.0 }),
}

describe("Task entity", () => {
  test("createTask sets defaults", () => {
    const task = createTask(baseParams)
    expect(task.status).toBe("queued")
    expect(task.version).toBe(1)
    expect(task.assignedTo).toBeNull()
    expect(task.tokensUsed).toBe(0)
    expect(task.artifacts).toEqual([])
    expect(task.parentTaskId).toBeNull()
  })

  test("canTransition: queued -> in_progress is allowed", () => {
    const task = createTask(baseParams)
    expect(canTransition(task, "in_progress")).toBe(true)
  })

  test("canTransition: queued -> approved is not allowed", () => {
    const task = createTask(baseParams)
    expect(canTransition(task, "approved")).toBe(false)
  })

  test("canTransition: review -> in_progress is allowed", () => {
    const task = createTask({ ...baseParams, status: "review" })
    expect(canTransition(task, "in_progress")).toBe(true)
  })

  test("canTransition: merged is terminal", () => {
    const task = createTask({ ...baseParams, status: "merged" })
    expect(canTransition(task, "in_progress")).toBe(false)
    expect(canTransition(task, "approved")).toBe(false)
  })

  test("canTransition: discarded is terminal", () => {
    const task = createTask({ ...baseParams, status: "discarded" })
    expect(canTransition(task, "in_progress")).toBe(false)
  })

  test("isOverBudget returns false when tokens within budget", () => {
    const task = createTask({ ...baseParams, tokensUsed: 500 })
    expect(isOverBudget(task)).toBe(false)
  })

  test("isOverBudget returns true when tokens exceed budget", () => {
    const task = createTask({ ...baseParams, tokensUsed: 1500 })
    expect(isOverBudget(task)).toBe(true)
  })
})
