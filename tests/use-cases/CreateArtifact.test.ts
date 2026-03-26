import { CreateArtifactUseCase } from "../../src/use-cases/CreateArtifact"
import { InMemoryArtifactRepo } from "../../src/adapters/storage/InMemoryArtifactRepo"
import { InMemoryTaskRepo } from "../../src/adapters/storage/InMemoryTaskRepo"
import { createArtifact } from "../../src/entities/Artifact"
import { createTask } from "../../src/entities/Task"
import { createTaskId, createGoalId, createAgentId, createArtifactId } from "../../src/entities/ids"
import { createBudget } from "../../src/entities/Budget"

describe("CreateArtifactUseCase", () => {
  let artifactRepo: InMemoryArtifactRepo
  let taskRepo: InMemoryTaskRepo
  let useCase: CreateArtifactUseCase

  beforeEach(() => {
    artifactRepo = new InMemoryArtifactRepo()
    taskRepo = new InMemoryTaskRepo()
    useCase = new CreateArtifactUseCase(artifactRepo, taskRepo)
  })

  it("stores artifact and links to task", async () => {
    const task = createTask({
      id: createTaskId("t-1"), goalId: createGoalId(), description: "test",
      phase: "spec", budget: createBudget({ maxTokens: 10000, maxCostUsd: 1.0 }),
    })
    await taskRepo.create(task)

    const artifact = createArtifact({
      id: createArtifactId("art-1"),
      kind: "spec",
      format: "markdown",
      taskId: "t-1" as any,
      createdBy: createAgentId("prod-1"),
      content: "# Spec",
      metadata: { requirementCount: 3, hasSuccessCriteria: true },
    })

    const result = await useCase.execute(artifact)
    expect(result.ok).toBe(true)

    const stored = await artifactRepo.findById("art-1" as any)
    expect(stored).not.toBeNull()
    expect(stored?.kind).toBe("spec")

    const updatedTask = await taskRepo.findById("t-1" as any)
    expect(updatedTask?.artifacts).toContain("art-1")
  })

  it("fails for unknown task", async () => {
    const artifact = createArtifact({
      id: createArtifactId("art-1"),
      kind: "spec",
      format: "markdown",
      taskId: createTaskId("missing"),
      createdBy: createAgentId("prod-1"),
      content: "# Spec",
      metadata: { requirementCount: 1, hasSuccessCriteria: false },
    })

    const result = await useCase.execute(artifact)
    expect(result.ok).toBe(false)
  })
})
