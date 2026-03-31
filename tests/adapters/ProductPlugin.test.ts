import { ProductPlugin } from "../../src/adapters/plugins/agents/ProductPlugin"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryArtifactRepo } from "../../src/adapters/storage/InMemoryArtifactRepo"
import { createTask } from "../../src/entities/Task"
import { createAgentId, createTaskId, createGoalId, createMessageId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import { success } from "../../src/use-cases/Result"

describe("ProductPlugin", () => {
  it("has correct identity and subscribes to task.assigned", () => {
    const plugin = createTestProductPlugin()
    expect(plugin.name).toBe("product-agent")
    const subs = plugin.subscriptions()
    expect(subs[0].types).toContain("task.assigned")
    expect(subs[0].agentId).toBe("product-1")
  })

  it("ignores messages for other agents", async () => {
    let executorCalled = false
    const plugin = createTestProductPlugin({
      executor: { async *run() { executorCalled = true; yield { type: "task_completed", data: {} } } } as any,
    })

    await plugin.handle({
      id: createMessageId(), type: "task.assigned",
      taskId: createTaskId("t-1"), agentId: createAgentId("other-agent"), timestamp: new Date(),
    })

    expect(executorCalled).toBe(false)
  })

  it("calls executor and creates spec artifact on task.assigned", async () => {
    let artifactCreated = false
    const taskRepo = new InMemoryTaskRepo()
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "write spec",
      phase: "spec", budget: createBudget({ maxTokens: 5000, maxCostUsd: 0.5 }),
    })
    await taskRepo.create(task)

    const plugin = createTestProductPlugin({
      taskRepo,
      executor: {
        async *run() {
          yield { type: "task_completed", data: { taskId: "t-1", content: "# Requirements\n1. Auth" } }
        },
      } as any,
      createArtifact: { execute: async () => { artifactCreated = true; return success(undefined) } } as any,
    })

    await plugin.handle({
      id: createMessageId(), type: "task.assigned",
      taskId: createTaskId("t-1"), agentId: createAgentId("product-1"), timestamp: new Date(),
    })

    expect(artifactCreated).toBe(true)
  })
})

function createTestProductPlugin(overrides: Record<string, any> = {}): ProductPlugin {
  return new ProductPlugin({
    agentId: createAgentId("product-1"),
    projectId: "proj-1" as any,
    executor: { async *run() { yield { type: "task_completed", data: {} } } } as any,
    taskRepo: overrides.taskRepo ?? new InMemoryTaskRepo(),
    artifactRepo: new InMemoryArtifactRepo(),
    createArtifact: overrides.createArtifact ?? { execute: async () => success(undefined) } as any,
    bus: new InMemoryBus(),
    systemPrompt: "Write a spec.",
    model: "sonnet",
    projectDir: "/tmp/project",
    ...overrides,
  })
}
