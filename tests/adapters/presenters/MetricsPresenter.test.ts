import { MetricsPresenter } from "../../../src/adapters/presenters/MetricsPresenter"
import { InMemoryTaskRepo } from "../../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryEventStore } from "../../../src/adapters/storage/InMemoryEventStore"
import { createTask } from "../../../src/entities/Task"
import { createBudget } from "../../../src/entities/Budget"
import { createTaskId, createGoalId, createEventId, createAgentId } from "../../../src/entities/ids"
import type { SystemEvent } from "../../../src/entities/Event"

describe("MetricsPresenter", () => {
  let taskRepo: InMemoryTaskRepo
  let eventStore: InMemoryEventStore
  let presenter: MetricsPresenter

  beforeEach(async () => {
    taskRepo = new InMemoryTaskRepo()
    eventStore = new InMemoryEventStore()
    presenter = new MetricsPresenter(taskRepo, eventStore)
    await taskRepo.create(createTask({ id: createTaskId("t-1"), goalId: createGoalId("g-1"), description: "A", phase: "code", budget: createBudget({ maxTokens: 10_000, maxCostUsd: 1 }), status: "in_progress", tokensUsed: 3_000 }))
    await taskRepo.create(createTask({ id: createTaskId("t-2"), goalId: createGoalId("g-1"), description: "B", phase: "review", budget: createBudget({ maxTokens: 5_000, maxCostUsd: 0.5 }), status: "merged", tokensUsed: 2_000 }))
    const event: SystemEvent = { id: createEventId(), type: "task.completed", agentId: createAgentId("dev-1"), taskId: createTaskId("t-1"), goalId: createGoalId("g-1"), cost: { inputTokens: 1_000, outputTokens: 500, totalTokens: 1_500, estimatedCostUsd: 0.05 }, occurredAt: new Date(), payload: null }
    await eventStore.append(event)
  })

  it("computes metrics summary", async () => {
    const dto = await presenter.present()
    expect(dto.totalTokensUsed).toBe(5_000)
    expect(dto.activeTaskCount).toBe(1)
    expect(dto.completedTaskCount).toBe(1)
    expect(dto.totalCostUsd).toBeCloseTo(0.05)
    expect(dto.agentTokenBreakdown["dev-1"]).toBe(1_500)
  })
})
