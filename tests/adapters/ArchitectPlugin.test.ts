import { ArchitectPlugin } from "../../src/adapters/plugins/agents/ArchitectPlugin"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryArtifactRepo } from "../../src/adapters/storage/InMemoryArtifactRepo"
import { createTask } from "../../src/entities/Task"
import { createArtifact } from "../../src/entities/Artifact"
import { createAgentId, createTaskId, createGoalId, createMessageId, createArtifactId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"
import { success } from "../../src/use-cases/Result"

describe("ArchitectPlugin", () => {
  it("has correct identity and subscribes to task.assigned filtered by agentId", () => {
    const plugin = createTestArchitectPlugin()
    expect(plugin.name).toBe("architect-agent")
    const subs = plugin.subscriptions()
    expect(subs[0].agentId).toBe("architect-1")
  })

  it("reads spec artifact before generating plan", async () => {
    const artifactRepo = new InMemoryArtifactRepo()
    const taskRepo = new InMemoryTaskRepo()

    const spec = createArtifact({
      id: createArtifactId("spec-1"), kind: "spec", format: "markdown",
      taskId: createTaskId("t-1"), createdBy: createAgentId("prod-1"),
      content: "# Requirements\n1. Auth", metadata: { requirementCount: 1, hasSuccessCriteria: false },
    })
    await artifactRepo.create(spec)

    const task = createTask({
      id: createTaskId("t-plan"), goalId: createGoalId(), description: "design plan",
      phase: "plan", budget: createBudget({ maxTokens: 5000, maxCostUsd: 0.5 }), artifacts: [createArtifactId("spec-1")],
    })
    await taskRepo.create(task)

    let artifactCreated = false
    const plugin = createTestArchitectPlugin({
      taskRepo, artifactRepo,
      createArtifact: { execute: async () => { artifactCreated = true; return success(undefined) } } as any,
    })

    await plugin.handle({
      id: createMessageId(), type: "task.assigned",
      taskId: createTaskId("t-plan"), agentId: createAgentId("architect-1"), timestamp: new Date(),
    })

    expect(artifactCreated).toBe(true)
  })
})

function createTestArchitectPlugin(overrides: Record<string, any> = {}): ArchitectPlugin {
  return new ArchitectPlugin({
    agentId: createAgentId("architect-1"),
    projectId: "proj-1" as any,
    executor: { async *run() { yield { type: "task_completed", data: { content: "# Plan\n## Step 1" } } } } as any,
    taskRepo: overrides.taskRepo ?? new InMemoryTaskRepo(),
    artifactRepo: overrides.artifactRepo ?? new InMemoryArtifactRepo(),
    createArtifact: overrides.createArtifact ?? { execute: async () => success(undefined) } as any,
    bus: new InMemoryBus(),
    systemPrompt: "Design a plan.",
    model: "sonnet",
    projectDir: "/tmp/project",
    ...overrides,
  })
}
