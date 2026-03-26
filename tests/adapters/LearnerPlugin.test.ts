import { LearnerPlugin } from "@adapters/plugins/agents/LearnerPlugin"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import { InMemoryEventStore } from "@adapters/storage/InMemoryEventStore"
import { InMemoryTaskRepo } from "@adapters/storage/InMemoryTaskRepo"
import { createTask } from "@entities/Task"
import { createAgentId, createTaskId, createGoalId, createMessageId } from "@entities/ids"
import { createBudget } from "@entities/Budget"

describe("LearnerPlugin", () => {
  it("has correct identity and subscribes to review/goal/budget events", () => {
    const plugin = createTestLearnerPlugin()
    expect(plugin.name).toBe("learner-agent")
    const subs = plugin.subscriptions()
    const types = subs.flatMap(s => s.types ?? [])
    expect(types).toContain("review.approved")
    expect(types).toContain("review.rejected")
    expect(types).toContain("goal.completed")
    expect(types).toContain("budget.exceeded")
  })

  it("creates KeepDiscardRecord on review.approved", async () => {
    const eventStore = new InMemoryEventStore()
    const taskRepo = new InMemoryTaskRepo()
    const task = createTask({
      id: createTaskId("t-1"),
      goalId: createGoalId(),
      description: "test",
      phase: "code",
      budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }),
      assignedTo: createAgentId("dev-1"),
    })
    await taskRepo.create(task)

    const plugin = createTestLearnerPlugin({ eventStore, taskRepo })

    await plugin.handle({
      id: createMessageId(),
      type: "review.approved",
      taskId: createTaskId("t-1"),
      reviewerId: createAgentId("rev-1"),
      timestamp: new Date(),
    })

    expect(plugin.keepDiscardRecords).toHaveLength(1)
    expect(plugin.keepDiscardRecords[0]?.verdict).toBe("approved")
  })

  it("creates KeepDiscardRecord on review.rejected", async () => {
    const taskRepo = new InMemoryTaskRepo()
    const task = createTask({
      id: createTaskId("t-1"),
      goalId: createGoalId(),
      description: "test",
      phase: "code",
      budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }),
      assignedTo: createAgentId("dev-1"),
    })
    await taskRepo.create(task)

    const plugin = createTestLearnerPlugin({ taskRepo })

    await plugin.handle({
      id: createMessageId(),
      type: "review.rejected",
      taskId: createTaskId("t-1"),
      reviewerId: createAgentId("rev-1"),
      reasons: ["no tests", "bad naming"],
      timestamp: new Date(),
    })

    expect(plugin.keepDiscardRecords).toHaveLength(1)
    expect(plugin.keepDiscardRecords[0]?.verdict).toBe("rejected")
    expect(plugin.keepDiscardRecords[0]?.reasons).toEqual(["no tests", "bad naming"])
  })

  it("records event on goal.completed", async () => {
    const eventStore = new InMemoryEventStore()
    const plugin = createTestLearnerPlugin({ eventStore })

    await plugin.handle({
      id: createMessageId(),
      type: "goal.completed",
      goalId: createGoalId("g-1"),
      costUsd: 0.5,
      timestamp: new Date(),
    })

    const events = await eventStore.findByGoalId(createGoalId("g-1"))
    expect(events.length).toBeGreaterThan(0)
  })

  it("records event on budget.exceeded", async () => {
    const eventStore = new InMemoryEventStore()
    const plugin = createTestLearnerPlugin({ eventStore })

    await plugin.handle({
      id: createMessageId(),
      type: "budget.exceeded",
      taskId: createTaskId("t-2"),
      agentId: createAgentId("dev-1"),
      tokensUsed: 9999,
      budgetMax: 5000,
      timestamp: new Date(),
    })

    const events = await eventStore.findByTaskId(createTaskId("t-2"))
    expect(events.length).toBeGreaterThan(0)
  })
})

function createTestLearnerPlugin(overrides: Record<string, unknown> = {}): LearnerPlugin {
  return new LearnerPlugin({
    agentId: createAgentId("learner-1"),
    bus: (overrides["bus"] as any) ?? new InMemoryBus(),
    eventStore: (overrides["eventStore"] as any) ?? new InMemoryEventStore(),
    taskRepo: (overrides["taskRepo"] as any) ?? new InMemoryTaskRepo(),
  })
}
