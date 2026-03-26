import { OpsPlugin } from "@adapters/plugins/agents/OpsPlugin"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import { InMemoryTaskRepo } from "@adapters/storage/InMemoryTaskRepo"
import { InMemoryArtifactRepo } from "@adapters/storage/InMemoryArtifactRepo"
import { createTask } from "@entities/Task"
import { createAgentId, createTaskId, createGoalId, createMessageId, createProjectId } from "@entities/ids"
import { createBudget } from "@entities/Budget"
import { success } from "../../src/use-cases/Result"
import type { Message } from "@entities/Message"

describe("OpsPlugin", () => {
  it("has correct identity and subscribes filtered by agentId", () => {
    const plugin = createTestOpsPlugin()
    expect(plugin.name).toBe("ops-agent")
    const subs = plugin.subscriptions()
    expect(subs[0]?.agentId).toBe("ops-1")
  })

  it("emits build.passed and test.report.created on success", async () => {
    const bus = new InMemoryBus()
    const emitted: Message[] = []
    bus.subscribe({}, async (msg) => { emitted.push(msg) })

    const taskRepo = new InMemoryTaskRepo()
    const task = createTask({
      id: createTaskId("t-1"),
      goalId: createGoalId(),
      description: "run tests",
      phase: "test",
      budget: createBudget({ maxTokens: 5000, maxCostUsd: 0.5 }),
    })
    await taskRepo.create(task)

    const plugin = createTestOpsPlugin({ taskRepo, bus })

    await plugin.handle({
      id: createMessageId(),
      type: "task.assigned",
      taskId: createTaskId("t-1"),
      agentId: createAgentId("ops-1"),
      timestamp: new Date(),
    })

    const buildMsg = emitted.find(m => m.type === "build.passed" || m.type === "build.failed")
    expect(buildMsg?.type).toBe("build.passed")
    const reportMsg = emitted.find(m => m.type === "test.report.created")
    expect(reportMsg).toBeDefined()
  })

  it("emits build.failed when executor signals failure", async () => {
    const bus = new InMemoryBus()
    const emitted: Message[] = []
    bus.subscribe({}, async (msg) => { emitted.push(msg) })

    const taskRepo = new InMemoryTaskRepo()
    const task = createTask({
      id: createTaskId("t-fail"),
      goalId: createGoalId(),
      description: "run failing tests",
      phase: "test",
      budget: createBudget({ maxTokens: 5000, maxCostUsd: 0.5 }),
    })
    await taskRepo.create(task)

    const plugin = createTestOpsPlugin({
      taskRepo,
      bus,
      executor: {
        async *run() {
          yield { type: "tool_executed", data: { toolName: "shell_run", success: false } }
          yield { type: "task_completed", data: { content: "Build FAILED\n0 passed, 3 failed" } }
        },
      } as any,
    })

    await plugin.handle({
      id: createMessageId(),
      type: "task.assigned",
      taskId: createTaskId("t-fail"),
      agentId: createAgentId("ops-1"),
      timestamp: new Date(),
    })

    const buildMsg = emitted.find(m => m.type === "build.passed" || m.type === "build.failed")
    expect(buildMsg?.type).toBe("build.failed")
  })

  it("emits task.completed for pipeline advancement", async () => {
    const bus = new InMemoryBus()
    const emitted: Message[] = []
    bus.subscribe({}, async (msg) => { emitted.push(msg) })

    const taskRepo = new InMemoryTaskRepo()
    const task = createTask({
      id: createTaskId("t-1"),
      goalId: createGoalId(),
      description: "run tests",
      phase: "test",
      budget: createBudget({ maxTokens: 5000, maxCostUsd: 0.5 }),
    })
    await taskRepo.create(task)

    const plugin = createTestOpsPlugin({ taskRepo, bus })
    await plugin.handle({
      id: createMessageId(),
      type: "task.assigned",
      taskId: createTaskId("t-1"),
      agentId: createAgentId("ops-1"),
      timestamp: new Date(),
    })

    expect(emitted.some(m => m.type === "task.completed")).toBe(true)
  })
})

function createTestOpsPlugin(overrides: Record<string, unknown> = {}): OpsPlugin {
  return new OpsPlugin({
    agentId: createAgentId("ops-1"),
    projectId: createProjectId("proj-1"),
    executor: (overrides["executor"] as any) ?? {
      async *run() {
        yield { type: "tool_executed", data: { toolName: "shell_run", success: true } }
        yield { type: "task_completed", data: { content: "Build OK\n10 passed, 0 failed" } }
      },
    },
    taskRepo: (overrides["taskRepo"] as any) ?? new InMemoryTaskRepo(),
    artifactRepo: (overrides["artifactRepo"] as any) ?? new InMemoryArtifactRepo(),
    createArtifact: (overrides["createArtifact"] as any) ?? { execute: async () => success(undefined) },
    bus: (overrides["bus"] as any) ?? new InMemoryBus(),
  })
}
