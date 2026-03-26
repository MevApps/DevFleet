import { EvaluateKeepDiscard } from "../../src/use-cases/EvaluateKeepDiscard"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { createTask } from "../../src/entities/Task"
import { createTaskId, createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

describe("EvaluateKeepDiscard", () => {
  let taskRepo: InMemoryTaskRepo
  let useCase: EvaluateKeepDiscard

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepo()
    useCase = new EvaluateKeepDiscard(taskRepo)
  })

  it("returns 'keep' when verdict is approved", async () => {
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "test",
      phase: "code", budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }), status: "review",
    })
    await taskRepo.create(task)

    const result = await useCase.execute("t-1" as any, "approved", 3)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe("keep")
  })

  it("returns 'retry' when rejected with retries remaining, increments retryCount", async () => {
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "test",
      phase: "code", budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }), status: "review", retryCount: 1,
    })
    await taskRepo.create(task)

    const result = await useCase.execute("t-1" as any, "rejected", 3)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe("retry")

    const updated = await taskRepo.findById("t-1" as any)
    expect(updated?.retryCount).toBe(2)
  })

  it("returns 'discard' when rejected with retries exhausted", async () => {
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "test",
      phase: "code", budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }), status: "review", retryCount: 3,
    })
    await taskRepo.create(task)

    const result = await useCase.execute("t-1" as any, "rejected", 3)
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.value).toBe("discard")
  })

  it("fails for unknown task", async () => {
    const result = await useCase.execute("missing" as any, "approved", 3)
    expect(result.ok).toBe(false)
  })
})
