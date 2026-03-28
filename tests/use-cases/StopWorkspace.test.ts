import { StopWorkspace } from "../../src/use-cases/StopWorkspace"
import { CleanupWorkspace } from "../../src/use-cases/CleanupWorkspace"
import { InMemoryWorkspaceRunRepository } from "../../src/adapters/storage/InMemoryWorkspaceRunRepository"
import { createWorkspaceRun } from "../../src/entities/WorkspaceRun"
import { createWorkspaceRunId } from "../../src/entities/ids"
import type { WorkspaceIsolator, WorkspaceHandle } from "../../src/use-cases/ports/WorkspaceIsolator"

const mockHandle: WorkspaceHandle = { id: "test-workspace" }

function createMockIsolator(): WorkspaceIsolator {
  return {
    create: async () => mockHandle,
    installDependencies: async () => undefined,
    getWorkspaceDir: () => "/tmp/test",
    cleanup: async () => undefined,
  }
}

describe("StopWorkspace and CleanupWorkspace", () => {
  it("scenario 1: Stop active with no failures → stopped, cleanup called", async () => {
    const runId = createWorkspaceRunId("run-1")
    const repo = new InMemoryWorkspaceRunRepository()
    const isolator = createMockIsolator()

    const activeRun = createWorkspaceRun({
      id: runId,
      config: {
        repoUrl: "https://github.com/test/repo",
        maxCostUsd: 10,
        maxTokens: 100_000,
        supervisorModel: "claude-opus",
        developerModel: "claude-sonnet",
        reviewerModel: "claude-opus",
        timeoutMs: 300_000,
      },
      status: "active",
      startedAt: new Date(),
    })

    await repo.create(activeRun)

    let cleanupCalled = false
    const isolatorWithSpy: WorkspaceIsolator = {
      ...isolator,
      cleanup: async () => {
        cleanupCalled = true
      },
    }

    const useCase = new StopWorkspace(repo, isolatorWithSpy)
    const result = await useCase.execute(runId, mockHandle, false)

    expect(result.ok).toBe(true)
    expect(cleanupCalled).toBe(true)

    const updated = await repo.findById(runId)
    expect(updated).not.toBeNull()
    expect(updated!.status).toBe("stopped")
    expect(updated!.completedAt).not.toBeNull()
  })

  it("scenario 2: Stop active with failures → stopped_dirty, no cleanup", async () => {
    const runId = createWorkspaceRunId("run-2")
    const repo = new InMemoryWorkspaceRunRepository()
    const isolator = createMockIsolator()

    const activeRun = createWorkspaceRun({
      id: runId,
      config: {
        repoUrl: "https://github.com/test/repo",
        maxCostUsd: 10,
        maxTokens: 100_000,
        supervisorModel: "claude-opus",
        developerModel: "claude-sonnet",
        reviewerModel: "claude-opus",
        timeoutMs: 300_000,
      },
      status: "active",
      startedAt: new Date(),
    })

    await repo.create(activeRun)

    let cleanupCalled = false
    const isolatorWithSpy: WorkspaceIsolator = {
      ...isolator,
      cleanup: async () => {
        cleanupCalled = true
      },
    }

    const useCase = new StopWorkspace(repo, isolatorWithSpy)
    const result = await useCase.execute(runId, mockHandle, true)

    expect(result.ok).toBe(true)
    expect(cleanupCalled).toBe(false)

    const updated = await repo.findById(runId)
    expect(updated).not.toBeNull()
    expect(updated!.status).toBe("stopped_dirty")
    expect(updated!.completedAt).not.toBeNull()
  })

  it("scenario 3: Cleanup stopped_dirty → stopped, cleanup called", async () => {
    const runId = createWorkspaceRunId("run-3")
    const repo = new InMemoryWorkspaceRunRepository()
    const isolator = createMockIsolator()

    const dirtyRun = createWorkspaceRun({
      id: runId,
      config: {
        repoUrl: "https://github.com/test/repo",
        maxCostUsd: 10,
        maxTokens: 100_000,
        supervisorModel: "claude-opus",
        developerModel: "claude-sonnet",
        reviewerModel: "claude-opus",
        timeoutMs: 300_000,
      },
      status: "stopped_dirty",
      startedAt: new Date(),
      completedAt: new Date(),
    })

    await repo.create(dirtyRun)

    let cleanupCalled = false
    const isolatorWithSpy: WorkspaceIsolator = {
      ...isolator,
      cleanup: async () => {
        cleanupCalled = true
      },
    }

    const useCase = new CleanupWorkspace(repo, isolatorWithSpy)
    const result = await useCase.execute(runId, mockHandle)

    expect(result.ok).toBe(true)
    expect(cleanupCalled).toBe(true)

    const updated = await repo.findById(runId)
    expect(updated).not.toBeNull()
    expect(updated!.status).toBe("stopped")
  })

  it("scenario 4: Cleanup rejects non-stopped_dirty", async () => {
    const runId = createWorkspaceRunId("run-4")
    const repo = new InMemoryWorkspaceRunRepository()
    const isolator = createMockIsolator()

    const activeRun = createWorkspaceRun({
      id: runId,
      config: {
        repoUrl: "https://github.com/test/repo",
        maxCostUsd: 10,
        maxTokens: 100_000,
        supervisorModel: "claude-opus",
        developerModel: "claude-sonnet",
        reviewerModel: "claude-opus",
        timeoutMs: 300_000,
      },
      status: "active",
      startedAt: new Date(),
    })

    await repo.create(activeRun)

    const useCase = new CleanupWorkspace(repo, isolator)
    const result = await useCase.execute(runId, mockHandle)

    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toMatch(/stopped_dirty/)
    }
  })
})
