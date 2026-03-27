import { LearnerPlugin } from "@adapters/plugins/agents/LearnerPlugin"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import { InMemoryTaskRepo } from "@adapters/storage/InMemoryTaskRepo"
import { InMemoryKeepDiscardRepository } from "@adapters/storage/InMemoryKeepDiscardRepository"
import { createTask } from "@entities/Task"
import { createAgentId, createTaskId, createGoalId, createMessageId } from "@entities/ids"
import { createBudget } from "@entities/Budget"

describe("LearnerPlugin", () => {
  it("subscribes to review.approved, review.rejected, goal.completed only", () => {
    const plugin = createTestLearnerPlugin()
    const types = plugin.subscriptions().flatMap(s => s.types ?? [])
    expect(types).toEqual(["review.approved", "review.rejected", "goal.completed"])
  })

  it("saves KeepDiscardRecord to repository on review.approved", async () => {
    const keepDiscardRepo = new InMemoryKeepDiscardRepository()
    const taskRepo = new InMemoryTaskRepo()
    await taskRepo.create(createTask({ id: createTaskId("t-1"), goalId: createGoalId("g-1"), description: "test", phase: "code", budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }), assignedTo: createAgentId("dev-1") }))
    const plugin = createTestLearnerPlugin({ keepDiscardRepo, taskRepo })
    await plugin.handle({ id: createMessageId(), type: "review.approved", taskId: createTaskId("t-1"), reviewerId: createAgentId("rev-1"), timestamp: new Date() })
    const records = await keepDiscardRepo.findAll()
    expect(records).toHaveLength(1)
    expect(records[0]?.verdict).toBe("approved")
    expect(records[0]?.goalId).toBe("g-1")
  })

  it("saves KeepDiscardRecord on review.rejected with reasons", async () => {
    const keepDiscardRepo = new InMemoryKeepDiscardRepository()
    const taskRepo = new InMemoryTaskRepo()
    await taskRepo.create(createTask({ id: createTaskId("t-1"), goalId: createGoalId(), description: "test", phase: "code", budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }), assignedTo: createAgentId("dev-1") }))
    const plugin = createTestLearnerPlugin({ keepDiscardRepo, taskRepo })
    await plugin.handle({ id: createMessageId(), type: "review.rejected", taskId: createTaskId("t-1"), reviewerId: createAgentId("rev-1"), reasons: ["no tests", "bad naming"], timestamp: new Date() })
    const records = await keepDiscardRepo.findAll()
    expect(records).toHaveLength(1)
    expect(records[0]?.verdict).toBe("rejected")
    expect(records[0]?.reasons).toEqual(["no tests", "bad naming"])
  })

  it("calls onGoalCompleted callback on goal.completed", async () => {
    let called = false
    const plugin = createTestLearnerPlugin({ onGoalCompleted: async () => { called = true } })
    await plugin.handle({ id: createMessageId(), type: "goal.completed", goalId: createGoalId("g-1"), costUsd: 0.5, timestamp: new Date() })
    expect(called).toBe(true)
  })
})

function createTestLearnerPlugin(overrides: Record<string, unknown> = {}): LearnerPlugin {
  return new LearnerPlugin({
    agentId: createAgentId("learner-1"),
    bus: (overrides["bus"] as any) ?? new InMemoryBus(),
    taskRepo: (overrides["taskRepo"] as any) ?? new InMemoryTaskRepo(),
    keepDiscardRepo: (overrides["keepDiscardRepo"] as any) ?? new InMemoryKeepDiscardRepository(),
    onGoalCompleted: overrides["onGoalCompleted"] as any,
  })
}
