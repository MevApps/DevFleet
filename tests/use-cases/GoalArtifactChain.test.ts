import { describe, it, expect } from "vitest"
import { GoalArtifactChain } from "../../src/use-cases/GoalArtifactChain"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { InMemoryArtifactRepo } from "../../src/adapters/storage/InMemoryArtifactRepo"
import { createTask } from "../../src/entities/Task"
import { createArtifact } from "../../src/entities/Artifact"
import { createBudget } from "../../src/entities/Budget"
import { createGoalId, createTaskId, createArtifactId, createAgentId } from "../../src/entities/ids"

describe("GoalArtifactChain", () => {
  it("gathers artifacts in pipeline phase order", async () => {
    const taskRepo = new InMemoryTaskRepo()
    const artifactRepo = new InMemoryArtifactRepo()
    const phases = ["spec", "plan", "code", "review"]
    const goalId = createGoalId("g-1")
    const budget = createBudget({ maxTokens: 1000, maxCostUsd: 0.1 })

    // Create tasks in reverse order to test sorting
    const planTaskId = createTaskId("t-plan")
    await taskRepo.create(createTask({
      id: planTaskId, goalId, description: "plan", phase: "plan", budget, status: "completed",
    }))

    const specTaskId = createTaskId("t-spec")
    await taskRepo.create(createTask({
      id: specTaskId, goalId, description: "spec", phase: "spec", budget, status: "completed",
      artifacts: [createArtifactId("a-spec")],
    }))

    // Update plan task with artifact
    const planTask = await taskRepo.findById(planTaskId)
    await taskRepo.update({ ...planTask!, artifacts: [createArtifactId("a-plan")], version: 2 })

    // Create artifacts
    await artifactRepo.create(createArtifact({
      id: createArtifactId("a-spec"), kind: "spec", format: "markdown",
      taskId: specTaskId, createdBy: createAgentId("product-1"),
      content: "Spec content here",
      metadata: { requirementCount: 3, hasSuccessCriteria: true },
    }))

    await artifactRepo.create(createArtifact({
      id: createArtifactId("a-plan"), kind: "plan", format: "markdown",
      taskId: planTaskId, createdBy: createAgentId("architect-1"),
      content: "Plan content here",
      metadata: { stepCount: 5, estimatedTokens: 2000 },
    }))

    const chain = new GoalArtifactChain(taskRepo, artifactRepo, phases)
    const result = await chain.gather(goalId)

    expect(result).toHaveLength(2)
    expect(result[0]!.phase).toBe("spec")
    expect(result[0]!.kind).toBe("spec")
    expect(result[0]!.content).toBe("Spec content here")
    expect(result[1]!.phase).toBe("plan")
    expect(result[1]!.kind).toBe("plan")
  })

  it("returns empty array when no completed tasks exist", async () => {
    const taskRepo = new InMemoryTaskRepo()
    const artifactRepo = new InMemoryArtifactRepo()
    const chain = new GoalArtifactChain(taskRepo, artifactRepo, ["spec", "plan"])

    const result = await chain.gather(createGoalId("g-empty"))
    expect(result).toEqual([])
  })

  it("skips tasks with no artifacts", async () => {
    const taskRepo = new InMemoryTaskRepo()
    const artifactRepo = new InMemoryArtifactRepo()
    const goalId = createGoalId("g-1")
    const budget = createBudget({ maxTokens: 1000, maxCostUsd: 0.1 })

    await taskRepo.create(createTask({
      id: createTaskId("t-spec"), goalId, description: "spec", phase: "spec",
      budget, status: "completed", artifacts: [],
    }))

    const chain = new GoalArtifactChain(taskRepo, artifactRepo, ["spec", "plan"])
    const result = await chain.gather(goalId)
    expect(result).toEqual([])
  })
})
