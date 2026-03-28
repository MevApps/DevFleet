import { ReviewerPlugin } from "@adapters/plugins/agents/ReviewerPlugin"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import { InMemoryTaskRepo } from "@adapters/storage/InMemoryTaskRepo"
import { InMemoryArtifactRepo } from "@adapters/storage/InMemoryArtifactRepo"
import { createTask } from "@entities/Task"
import { createAgentId, createTaskId, createGoalId, createMessageId, createProjectId } from "@entities/ids"
import { createBudget } from "@entities/Budget"
import { success } from "../../src/use-cases/Result"
import type { Message } from "@entities/Message"

describe("ReviewerPlugin", () => {
  it("has correct identity and subscribes filtered by agentId", () => {
    const plugin = createTestReviewerPlugin()
    expect(plugin.name).toBe("reviewer-agent")
    const subs = plugin.subscriptions()
    expect(subs[0]?.types).toContain("task.assigned")
    expect(subs[0]?.agentId).toBe("reviewer-1")
  })

  it("ignores messages for other agents", async () => {
    let executorCalled = false
    const plugin = createTestReviewerPlugin({
      executor: {
        async *run() { executorCalled = true; yield { type: "task_completed", data: {} } },
      } as any,
    })
    await plugin.handle({
      id: createMessageId(),
      type: "task.assigned",
      taskId: createTaskId("t-1"),
      agentId: createAgentId("other"),
      timestamp: new Date(),
    })
    expect(executorCalled).toBe(false)
  })

  it("emits review.approved when AI verdict is approved", async () => {
    const bus = new InMemoryBus()
    const emitted: Message[] = []
    bus.subscribe({}, async (msg) => { emitted.push(msg) })

    const taskRepo = new InMemoryTaskRepo()
    const task = createTask({
      id: createTaskId("t-1"),
      goalId: createGoalId(),
      description: "review code",
      phase: "review",
      budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }),
    })
    await taskRepo.create(task)

    const plugin = createTestReviewerPlugin({
      taskRepo,
      bus,
      executor: {
        async *run() {
          yield { type: "task_completed", data: { content: "APPROVED\nAll tests pass." } }
        },
      } as any,
    })

    await plugin.handle({
      id: createMessageId(),
      type: "task.assigned",
      taskId: createTaskId("t-1"),
      agentId: createAgentId("reviewer-1"),
      timestamp: new Date(),
    })

    const reviewMsg = emitted.find(m => m.type === "review.approved" || m.type === "review.rejected")
    expect(reviewMsg?.type).toBe("review.approved")
  })

  it("emits review.rejected when AI verdict is rejected", async () => {
    const bus = new InMemoryBus()
    const emitted: Message[] = []
    bus.subscribe({}, async (msg) => { emitted.push(msg) })

    const taskRepo = new InMemoryTaskRepo()
    const task = createTask({
      id: createTaskId("t-1"),
      goalId: createGoalId(),
      description: "review code",
      phase: "review",
      budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }),
    })
    await taskRepo.create(task)

    const plugin = createTestReviewerPlugin({
      taskRepo,
      bus,
      executor: {
        async *run() {
          yield { type: "task_completed", data: { content: "REJECTED\nNo tests found.\nNaming violations." } }
        },
      } as any,
    })

    await plugin.handle({
      id: createMessageId(),
      type: "task.assigned",
      taskId: createTaskId("t-1"),
      agentId: createAgentId("reviewer-1"),
      timestamp: new Date(),
    })

    const reviewMsg = emitted.find(m => m.type === "review.rejected")
    expect(reviewMsg?.type).toBe("review.rejected")
  })
})

function createTestReviewerPlugin(overrides: Record<string, unknown> = {}): ReviewerPlugin {
  return new ReviewerPlugin({
    agentId: createAgentId("reviewer-1"),
    projectId: createProjectId("proj-1"),
    executor: overrides["executor"] as any ?? {
      async *run() { yield { type: "task_completed", data: { content: "APPROVED" } } },
    },
    taskRepo: (overrides["taskRepo"] as any) ?? new InMemoryTaskRepo(),
    artifactRepo: (overrides["artifactRepo"] as any) ?? new InMemoryArtifactRepo(),
    createArtifact: (overrides["createArtifact"] as any) ?? { execute: async () => success(undefined) },
    bus: (overrides["bus"] as any) ?? new InMemoryBus(),
    systemPrompt: "Review this code.",
    model: "claude-opus-4-6",
    workspaceDir: "/tmp/workspace",
    ...Object.fromEntries(
      Object.entries(overrides).filter(([k]) =>
        !["executor", "taskRepo", "artifactRepo", "createArtifact", "bus"].includes(k)
      )
    ),
  })
}
