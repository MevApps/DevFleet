import { ComputePhaseTimings } from "@use-cases/ComputePhaseTimings"
import { InMemoryEventStore } from "@adapters/storage/InMemoryEventStore"
import { InMemoryTaskRepo } from "@adapters/storage/InMemoryTaskRepo"
import { createTask } from "@entities/Task"
import { createTaskId, createGoalId, createAgentId, createEventId } from "@entities/ids"
import { createBudget } from "@entities/Budget"

describe("ComputePhaseTimings", () => {
  it("computes average duration per phase from task.assigned/task.completed events", async () => {
    const eventStore = new InMemoryEventStore()
    const taskRepo = new InMemoryTaskRepo()
    const taskId = createTaskId("t-1")
    await taskRepo.create(createTask({ id: taskId, goalId: createGoalId(), description: "d", phase: "code", budget: createBudget({ maxTokens: 10000, maxCostUsd: 1 }) }))
    const base = new Date("2026-01-01T00:00:00Z")
    await eventStore.append({ id: createEventId(), type: "task.assigned", agentId: createAgentId("dev-1"), taskId, goalId: null, cost: null, occurredAt: base, payload: {} })
    await eventStore.append({ id: createEventId(), type: "task.completed", agentId: createAgentId("dev-1"), taskId, goalId: null, cost: null, occurredAt: new Date(base.getTime() + 5000), payload: {} })
    const uc = new ComputePhaseTimings(eventStore, taskRepo)
    const report = await uc.execute()
    expect(report.avgDurationByPhase["code"]).toBe(5000)
  })
})
