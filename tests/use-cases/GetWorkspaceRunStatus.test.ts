import { GetWorkspaceRunStatus } from "../../src/use-cases/GetWorkspaceRunStatus"
import { InMemoryWorkspaceRunRepository } from "../../src/adapters/storage/InMemoryWorkspaceRunRepository"
import { createWorkspaceRunId } from "../../src/entities/ids"
import { createWorkspaceRun, DEFAULT_WORKSPACE_CONFIG } from "../../src/entities/WorkspaceRun"

describe("GetWorkspaceRunStatus", () => {
  it("returns the workspace run when found", async () => {
    const runId = createWorkspaceRunId("run-1")
    const run = createWorkspaceRun({
      id: runId,
      config: {
        repoUrl: "https://github.com/test/repo",
        ...DEFAULT_WORKSPACE_CONFIG,
      },
      status: "active",
    })

    const repo = new InMemoryWorkspaceRunRepository()
    await repo.create(run)

    const uc = new GetWorkspaceRunStatus(repo)
    const result = await uc.execute(runId)

    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(result.value.run.id).toBe(runId)
      expect(result.value.run.status).toBe("active")
    }
  })

  it("returns failure for unknown run", async () => {
    const repo = new InMemoryWorkspaceRunRepository()
    const uc = new GetWorkspaceRunStatus(repo)
    const unknownRunId = createWorkspaceRunId("unknown")

    const result = await uc.execute(unknownRunId)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/not found/i)
    }
  })
})
