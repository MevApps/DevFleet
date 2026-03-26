import { InMemoryArtifactRepo } from "../../src/adapters/storage/InMemoryArtifactRepo"
import { createArtifact } from "../../src/entities/Artifact"
import { createArtifactId, createTaskId, createAgentId } from "../../src/entities/ids"

describe("InMemoryArtifactRepo", () => {
  let repo: InMemoryArtifactRepo

  beforeEach(() => { repo = new InMemoryArtifactRepo() })

  it("creates and finds by id", async () => {
    const artifact = createArtifact({
      id: createArtifactId("a-1"), kind: "spec", format: "markdown",
      taskId: createTaskId("t-1"), createdBy: createAgentId("p-1"),
      content: "spec", metadata: { requirementCount: 1, hasSuccessCriteria: true },
    })
    await repo.create(artifact)
    const found = await repo.findById("a-1" as any)
    expect(found?.kind).toBe("spec")
  })

  it("finds by taskId", async () => {
    const tid = createTaskId("t-1")
    const a1 = createArtifact({ id: createArtifactId("a-1"), kind: "spec", format: "md", taskId: tid, createdBy: createAgentId("p-1"), content: "s", metadata: { requirementCount: 1, hasSuccessCriteria: true } })
    const a2 = createArtifact({ id: createArtifactId("a-2"), kind: "plan", format: "md", taskId: tid, createdBy: createAgentId("a-1"), content: "p", metadata: { stepCount: 3, estimatedTokens: 5000 } })
    await repo.create(a1)
    await repo.create(a2)
    const found = await repo.findByTaskId(tid)
    expect(found).toHaveLength(2)
  })

  it("returns null for unknown id", async () => {
    const found = await repo.findById(createArtifactId("nope"))
    expect(found).toBeNull()
  })
})
