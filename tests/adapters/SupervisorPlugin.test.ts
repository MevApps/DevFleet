import { SupervisorPlugin, type SupervisorPluginDeps } from "../../src/adapters/plugins/agents/SupervisorPlugin"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryGoalRepo } from "../../src/adapters/storage/InMemoryGoalRepo"
import { InMemoryAgentRegistry } from "../../src/adapters/storage/InMemoryAgentRegistry"
import { createAgentId, createGoalId, createTaskId, createMessageId } from "../../src/entities/ids"
import { createPipelineConfig } from "../../src/entities/PipelineConfig"
import { ROLES } from "../../src/entities/AgentRole"
import { success } from "../../src/use-cases/Result"
import type { SessionEvent } from "../../src/use-cases/ports/AgentSession"

function createMockAgentSession(result: string = "[]") {
  return {
    async *launch(): AsyncIterable<SessionEvent> {
      yield { type: "started" as const, sessionId: "s-1", model: "claude-opus-4-6" }
      yield { type: "completed" as const, result, totalTokensIn: 100, totalTokensOut: 200, durationMs: 500, numTurns: 1 }
    },
  }
}

describe("SupervisorPlugin", () => {
  it("has correct identity", () => {
    const plugin = createTestPlugin()
    expect(plugin.name).toBe("supervisor-agent")
    expect(plugin.id).toContain("supervisor")
  })

  it("subscribes to correct message types", () => {
    const plugin = createTestPlugin()
    const subs = plugin.subscriptions()
    const types = subs.flatMap(s => s.types ?? [])
    expect(types).toContain("goal.created")
    expect(types).toContain("task.completed")
    expect(types).toContain("code.completed")
    expect(types).toContain("task.failed")
    expect(types).toContain("review.approved")
    expect(types).toContain("review.rejected")
    expect(types).toContain("budget.exceeded")
    expect(types).toContain("agent.stuck")
  })

  it("handles goal.created by calling DecomposeGoal", async () => {
    let decomposeCalled = false
    const plugin = createTestPlugin({
      decomposeGoal: { execute: async () => { decomposeCalled = true; return success(undefined) } } as any,
    })

    await plugin.handle({
      id: createMessageId(), type: "goal.created",
      goalId: createGoalId("g-1"), description: "Add auth", timestamp: new Date(),
    })

    // goal.created is fire-and-forget — wait for the async handler to complete
    await new Promise(resolve => setTimeout(resolve, 100))
    expect(decomposeCalled).toBe(true)
  })

  it("handles review.approved by calling EvaluateKeepDiscard then MergeBranch", async () => {
    let mergeCalled = false
    const taskRepo = new InMemoryTaskRepo()
    const goalId = createGoalId("g-1")

    // Create a code task with a branch (to be found for merging)
    const { createTask } = await import("../../src/entities/Task")
    const { createBudget } = await import("../../src/entities/Budget")
    await taskRepo.create(createTask({
      id: createTaskId("t-code"), goalId, description: "code task",
      phase: "code", budget: createBudget({ maxTokens: 1000, maxCostUsd: 0.1 }),
      branch: "devfleet/task-t-code",
    }))

    // Create the review task (the one being reviewed)
    await taskRepo.create(createTask({
      id: createTaskId("t-1"), goalId, description: "review task",
      phase: "review", budget: createBudget({ maxTokens: 1000, maxCostUsd: 0.1 }),
    }))

    const plugin = createTestPlugin({
      taskRepo,
      evaluateKeepDiscard: { execute: async () => success("keep" as const) } as any,
      mergeBranch: { execute: async () => { mergeCalled = true; return success("abc123") } } as any,
    })

    await plugin.handle({
      id: createMessageId(), type: "review.approved",
      taskId: createTaskId("t-1"), reviewerId: createAgentId("rev-1"), timestamp: new Date(),
    })

    expect(mergeCalled).toBe(true)
  })
})

function createTestPlugin(overrides: Partial<SupervisorPluginDeps> = {}): SupervisorPlugin {
  const mockDetectProjectConfig = {
    execute: jest.fn().mockResolvedValue({
      language: "typescript",
      buildCommand: "npm run build",
      testCommand: "npm test",
      sourceRoots: ["src"],
    }),
  }

  const defaults: SupervisorPluginDeps = {
    agentId: createAgentId("supervisor-1"),
    projectId: "proj-1" as any,
    bus: new InMemoryBus(),
    taskRepo: new InMemoryTaskRepo(),
    goalRepo: new InMemoryGoalRepo(),
    agentRegistry: new InMemoryAgentRegistry(),
    decomposeGoal: { execute: async () => success(undefined) } as any,
    assignTask: { execute: async () => success(undefined) } as any,
    agentSession: createMockAgentSession(),
    evaluateKeepDiscard: { execute: async () => success("keep" as const) } as any,
    mergeBranch: { execute: async () => success("abc") } as any,
    discardBranch: { execute: async () => success(undefined) } as any,
    detectProjectConfig: mockDetectProjectConfig as any,
    pipelineConfig: createPipelineConfig({
      phases: ["spec", "plan", "code", "review"],
      transitions: [{ from: "spec", to: "plan" }, { from: "plan", to: "code" }, { from: "code", to: "review" }],
      roleMapping: [
        { phase: "spec", role: ROLES.PRODUCT },
        { phase: "plan", role: ROLES.ARCHITECT },
        { phase: "code", role: ROLES.DEVELOPER },
        { phase: "review", role: ROLES.REVIEWER },
      ],
    }),
    maxRetries: 3,
    model: "claude-opus-4-6",
    systemPrompt: "You are a supervisor.",
    workspaceDir: "/tmp/workspace",
  }
  return new SupervisorPlugin({ ...defaults, ...overrides })
}
