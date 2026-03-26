import { DiscardBranch } from "../../src/use-cases/DiscardBranch"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { InMemoryWorktreeManager } from "../../src/adapters/storage/InMemoryWorktreeManager"
import { createTask } from "../../src/entities/Task"
import { createTaskId, createGoalId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import type { Message } from "../../src/entities/Message"

describe("DiscardBranch", () => {
  let taskRepo: InMemoryTaskRepo
  let bus: InMemoryBus
  let worktree: InMemoryWorktreeManager
  let useCase: DiscardBranch
  const emitted: Message[] = []

  beforeEach(() => {
    taskRepo = new InMemoryTaskRepo()
    bus = new InMemoryBus()
    worktree = new InMemoryWorktreeManager()
    useCase = new DiscardBranch(taskRepo, worktree, bus)
    emitted.length = 0
    bus.subscribe({}, async (msg) => { emitted.push(msg) })
  })

  it("deletes branch and transitions task to discarded", async () => {
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "test",
      phase: "code", budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }), status: "review",
      branch: "devfleet/task-t-1",
    })
    await taskRepo.create(task)
    await worktree.create("devfleet/task-t-1")

    const result = await useCase.execute("t-1" as any, "max retries exceeded")
    expect(result.ok).toBe(true)

    const updated = await taskRepo.findById("t-1" as any)
    expect(updated?.status).toBe("discarded")

    expect(emitted).toHaveLength(1)
    expect(emitted[0].type).toBe("branch.discarded")
    if (emitted[0].type === "branch.discarded") {
      expect(emitted[0].reason).toBe("max retries exceeded")
    }
  })
})
