import { createWorkspaceRun, type WorkspaceRunConfig } from "../../src/entities/WorkspaceRun"
import { createWorkspaceRunId } from "../../src/entities/ids"

const DEFAULT_CONFIG: WorkspaceRunConfig = {
  repoUrl: "https://github.com/user/repo.git",
  maxCostUsd: 10.0,
  maxTokens: 200_000,
  supervisorModel: "claude-opus-4-20250514",
  developerModel: "claude-sonnet-4-20250514",
  reviewerModel: "claude-opus-4-20250514",
  timeoutMs: 600_000,
}

describe("WorkspaceRun", () => {
  it("creates with status 'created' and null optionals", () => {
    const run = createWorkspaceRun({ id: createWorkspaceRunId("ws-1"), config: DEFAULT_CONFIG })
    expect(run.status).toBe("created")
    expect(run.projectConfig).toBeNull()
    expect(run.completedAt).toBeNull()
    expect(run.error).toBeNull()
  })

  it("is frozen (immutable)", () => {
    const run = createWorkspaceRun({ id: createWorkspaceRunId("ws-2"), config: DEFAULT_CONFIG })
    expect(() => { (run as any).status = "active" }).toThrow()
  })

  it("preserves config", () => {
    const run = createWorkspaceRun({ id: createWorkspaceRunId("ws-3"), config: DEFAULT_CONFIG })
    expect(run.config.repoUrl).toBe("https://github.com/user/repo.git")
    expect(run.config.maxCostUsd).toBe(10.0)
  })
})
