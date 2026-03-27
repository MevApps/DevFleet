import { CheckBudget } from "../../src/use-cases/CheckBudget"
import type { TaskRepository } from "../../src/use-cases/ports/TaskRepository"
import { createTaskId, createGoalId } from "../../src/entities/ids"
import { createTask } from "../../src/entities/Task"
import { createBudget } from "../../src/entities/Budget"

function makeTask(maxTokens: number, tokensUsed: number) {
  return createTask({
    id: createTaskId("t1"),
    goalId: createGoalId("g1"),
    description: "test",
    phase: "dev",
    budget: createBudget({ maxTokens, maxCostUsd: 1 }),
    tokensUsed,
  })
}

describe("CheckBudget", () => {
  it("returns canProceed=true when estimated tokens fit within remaining budget", async () => {
    const task = makeTask(1000, 200)
    const repo: TaskRepository = {
      findById: async () => task,
      findByGoalId: async () => [],
      findAll: async () => [],
      create: async () => undefined,
      update: async () => undefined,
    }
    const uc = new CheckBudget(repo)
    const result = await uc.execute(task.id, 100)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.canProceed).toBe(true)
      expect(result.value.remaining).toBe(800) // 1000 - 200
      expect(result.value.estimatedCost).toBe(100)
    }
  })

  it("returns canProceed=false when estimated tokens exceed remaining budget", async () => {
    const task = makeTask(1000, 950)
    const repo: TaskRepository = {
      findById: async () => task,
      findByGoalId: async () => [],
      findAll: async () => [],
      create: async () => undefined,
      update: async () => undefined,
    }
    const uc = new CheckBudget(repo)
    const result = await uc.execute(task.id, 200)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.canProceed).toBe(false)
      expect(result.value.remaining).toBe(50) // 1000 - 950
    }
  })

  it("returns failure when task not found", async () => {
    const repo: TaskRepository = {
      findById: async () => null,
      findByGoalId: async () => [],
      findAll: async () => [],
      create: async () => undefined,
      update: async () => undefined,
    }
    const uc = new CheckBudget(repo)
    const result = await uc.execute(createTaskId("missing"), 100)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/not found/i)
    }
  })

  it("returns canProceed=true when remaining is exactly equal to estimatedTokens", async () => {
    const task = makeTask(1000, 500)
    const repo: TaskRepository = {
      findById: async () => task,
      findByGoalId: async () => [],
      findAll: async () => [],
      create: async () => undefined,
      update: async () => undefined,
    }
    const uc = new CheckBudget(repo)
    const result = await uc.execute(task.id, 500)
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.canProceed).toBe(true)
    }
  })
})
