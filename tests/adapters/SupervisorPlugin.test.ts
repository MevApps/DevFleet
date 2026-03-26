import { SupervisorPlugin, type SupervisorPluginDeps } from "../../src/adapters/plugins/agents/SupervisorPlugin"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryGoalRepo } from "../../src/adapters/storage/InMemoryGoalRepo"
import { InMemoryAgentRegistry } from "../../src/adapters/storage/InMemoryAgentRegistry"
import { createAgentId, createGoalId, createTaskId, createMessageId } from "../../src/entities/ids"
import { createPipelineConfig } from "../../src/entities/PipelineConfig"
import { ROLES } from "../../src/entities/AgentRole"
import { success } from "../../src/use-cases/Result"

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

    expect(decomposeCalled).toBe(true)
  })

  it("handles review.approved by calling EvaluateKeepDiscard then MergeBranch", async () => {
    let mergeCalled = false
    const plugin = createTestPlugin({
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
  const defaults: SupervisorPluginDeps = {
    agentId: createAgentId("supervisor-1"),
    projectId: "proj-1" as any,
    bus: new InMemoryBus(),
    taskRepo: new InMemoryTaskRepo(),
    goalRepo: new InMemoryGoalRepo(),
    agentRegistry: new InMemoryAgentRegistry(),
    decomposeGoal: { execute: async () => success(undefined) } as any,
    assignTask: { execute: async () => success(undefined) } as any,
    promptAgent: { execute: async () => success({ content: "[]", toolCalls: [], tokensIn: 0, tokensOut: 0, stopReason: "end_turn" as const }) } as any,
    evaluateKeepDiscard: { execute: async () => success("keep" as const) } as any,
    mergeBranch: { execute: async () => success("abc") } as any,
    discardBranch: { execute: async () => success(undefined) } as any,
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
  }
  return new SupervisorPlugin({ ...defaults, ...overrides })
}
