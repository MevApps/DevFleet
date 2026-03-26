import { MergeBranch } from "../../src/use-cases/MergeBranch"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { InMemoryWorktreeManager } from "../../src/adapters/storage/InMemoryWorktreeManager"
import { createTask } from "../../src/entities/Task"
import { createTaskId, createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import type { Message } from "../../src/entities/Message"

describe("MergeBranch", () => {
  let taskRepo: InMemoryTaskRepo
  let bus: InMemoryBus
  let worktree: InMemoryWorktreeManager
  let useCase: MergeBranch
  const emitted: Message[] = []

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepo()
    bus = new InMemoryBus()
    worktree = new InMemoryWorktreeManager()
    useCase = new MergeBranch(taskRepo, worktree, bus)
    emitted.length = 0
    bus.subscribe({}, async (msg) => { emitted.push(msg) })
  })

  it("merges branch and transitions task to approved", async () => {
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "test",
      phase: "code", budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }), status: "review",
      branch: "devfleet/task-t-1",
    })
    await taskRepo.create(task)
    await worktree.create("devfleet/task-t-1")

    const result = await useCase.execute("t-1" as any)
    expect(result.ok).toBe(true)

    const updated = await taskRepo.findById("t-1" as any)
    expect(updated?.status).toBe("merged")

    expect(emitted).toHaveLength(1)
    expect(emitted[0].type).toBe("branch.merged")
  })

  it("fails when task has no branch", async () => {
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "test",
      phase: "code", budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }), status: "review",
    })
    await taskRepo.create(task)

    const result = await useCase.execute("t-1" as any)
    expect(result.ok).toBe(false)
  })
})
