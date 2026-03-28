import { WorkspaceRunManager, type WorkspaceRunManagerDeps } from "../../src/use-cases/WorkspaceRunManager"
import type { WorkspaceRunRepository } from "../../src/use-cases/ports/WorkspaceRunRepository"
import type { WorkspaceIsolator, WorkspaceHandle } from "../../src/use-cases/ports/WorkspaceIsolator"
import type { FileSystem } from "../../src/use-cases/ports/FileSystem"
import type { GitRemote } from "../../src/use-cases/ports/GitRemote"
import type { PullRequestCreator } from "../../src/use-cases/ports/PullRequestCreator"
import type { MessagePort } from "../../src/use-cases/ports/MessagePort"
import type { DevFleetSystem, DevFleetConfig } from "../../src/infrastructure/config/composition-root"
import type { WorkspaceRun, WorkspaceRunConfig, WorkspaceRunStatus } from "../../src/entities/WorkspaceRun"
import type { WorkspaceRunId } from "../../src/entities/ids"
import { createWorkspaceRun, DEFAULT_WORKSPACE_CONFIG } from "../../src/entities/WorkspaceRun"
import { createWorkspaceRunId } from "../../src/entities/ids"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const TEST_REPO_URL = "https://github.com/test/repo.git"

function makeConfig(overrides: Partial<WorkspaceRunConfig> = {}): WorkspaceRunConfig {
  return { ...DEFAULT_WORKSPACE_CONFIG, repoUrl: TEST_REPO_URL, ...overrides }
}

function mockFs(): FileSystem {
  return {
    read: jest.fn().mockResolvedValue(""),
    write: jest.fn().mockResolvedValue(undefined),
    edit: jest.fn().mockResolvedValue(undefined),
    glob: jest.fn().mockResolvedValue([]),
    exists: jest.fn().mockResolvedValue(false),
  }
}

function mockBus(): MessagePort {
  return {
    emit: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockReturnValue(() => {}),
  }
}

function mockSystem(bus?: MessagePort): DevFleetSystem {
  const theBus = bus ?? mockBus()
  return {
    taskRepo: {} as any,
    goalRepo: {} as any,
    agentRegistry: {} as any,
    eventStore: {} as any,
    metricRecorder: {} as any,
    artifactRepo: {} as any,
    bus: theBus,
    pluginRegistry: {} as any,
    pipelineTimeoutMs: 300_000,
    dashboardDeps: { createGoal: { execute: jest.fn() } } as any,
    start: jest.fn().mockResolvedValue(undefined),
    stop: jest.fn().mockResolvedValue(undefined),
  }
}

// ---------------------------------------------------------------------------
// In-memory WorkspaceRunRepository
// ---------------------------------------------------------------------------
function createInMemoryRepo(): WorkspaceRunRepository {
  const store = new Map<string, WorkspaceRun>()
  return {
    async create(run: WorkspaceRun) { store.set(run.id, run) },
    async findById(id: WorkspaceRunId) { return store.get(id) ?? null },
    async findActive() {
      for (const run of store.values()) {
        if (run.status === "active") return run
      }
      return null
    },
    async findByStatus(status: WorkspaceRunStatus) {
      for (const run of store.values()) {
        if (run.status === status) return run
      }
      return null
    },
    async update(run: WorkspaceRun) { store.set(run.id, run) },
  }
}

// ---------------------------------------------------------------------------
// Mock WorkspaceIsolator
// ---------------------------------------------------------------------------
function createMockIsolator(): WorkspaceIsolator & { handles: WorkspaceHandle[] } {
  const handles: WorkspaceHandle[] = []
  return {
    handles,
    async create(_repoUrl: string): Promise<WorkspaceHandle> {
      const handle: WorkspaceHandle = { id: `handle-${handles.length}` }
      handles.push(handle)
      return handle
    },
    async installDependencies(_handle: WorkspaceHandle, _command: string) {},
    getWorkspaceDir(handle: WorkspaceHandle): string {
      return `/tmp/workspace-${handle.id}`
    },
    async cleanup(_handle: WorkspaceHandle) {},
  }
}

// ---------------------------------------------------------------------------
// Build full deps
// ---------------------------------------------------------------------------
function buildDeps(overrides: Partial<WorkspaceRunManagerDeps> = {}): WorkspaceRunManagerDeps {
  const system = mockSystem()
  return {
    repo: createInMemoryRepo(),
    isolator: createMockIsolator(),
    fsFactory: () => mockFs(),
    gitRemote: { push: jest.fn().mockResolvedValue(undefined) } as GitRemote,
    prCreator: {
      create: jest.fn().mockResolvedValue("https://github.com/test/repo/pull/1"),
      merge: jest.fn().mockResolvedValue(undefined),
    } as PullRequestCreator,
    autoMerge: false,
    buildSystem: jest.fn().mockResolvedValue(system),
    mockMode: true,
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe("WorkspaceRunManager", () => {
  describe("startRun", () => {
    it("creates workspace, calls isolator.create, calls buildSystem, returns run ID", async () => {
      const deps = buildDeps()
      const manager = new WorkspaceRunManager(deps)

      const result = await manager.startRun(makeConfig())

      expect(result.ok).toBe(true)
      if (!result.ok) return
      expect(result.value).toBeDefined()
      expect(deps.buildSystem).toHaveBeenCalledTimes(1)

      // Verify the system config passed to buildSystem
      const systemConfig = (deps.buildSystem as jest.Mock).mock.calls[0][0] as DevFleetConfig
      expect(systemConfig.mockMode).toBe(true)
      expect(systemConfig.workspaceDir).toContain("handle-0")
    })

    it("rejects a second startRun while one is active", async () => {
      const deps = buildDeps()
      const manager = new WorkspaceRunManager(deps)

      const first = await manager.startRun(makeConfig())
      expect(first.ok).toBe(true)

      const second = await manager.startRun(makeConfig())
      expect(second.ok).toBe(false)
      if (!second.ok) {
        expect(second.error).toContain("already active")
      }
    })

    it("marks run as failed when buildSystem throws", async () => {
      const deps = buildDeps({
        buildSystem: jest.fn().mockRejectedValue(new Error("build failed")),
      })
      const manager = new WorkspaceRunManager(deps)

      const result = await manager.startRun(makeConfig())
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toBe("build failed")
      }

      // Verify run status in repo is "failed"
      const active = await deps.repo.findActive()
      expect(active).toBeNull()
      const failed = await deps.repo.findByStatus("failed")
      expect(failed).not.toBeNull()
      expect(failed!.error).toBe("build failed")
    })

    it("calls system.start after buildSystem succeeds", async () => {
      const system = mockSystem()
      const deps = buildDeps({ buildSystem: jest.fn().mockResolvedValue(system) })
      const manager = new WorkspaceRunManager(deps)

      await manager.startRun(makeConfig())
      expect(system.start).toHaveBeenCalledTimes(1)
    })

    it("subscribes to bus for goal.completed and goal.abandoned", async () => {
      const bus = mockBus()
      const system = mockSystem(bus)
      const deps = buildDeps({ buildSystem: jest.fn().mockResolvedValue(system) })
      const manager = new WorkspaceRunManager(deps)

      await manager.startRun(makeConfig())

      // Two subscriptions: goal.completed and goal.abandoned
      expect(bus.subscribe).toHaveBeenCalledTimes(2)
      const firstFilter = (bus.subscribe as jest.Mock).mock.calls[0][0]
      const secondFilter = (bus.subscribe as jest.Mock).mock.calls[1][0]
      expect(firstFilter.types).toContain("goal.completed")
      expect(secondFilter.types).toContain("goal.abandoned")
    })
  })

  describe("findActive", () => {
    it("returns null when no workspace is active", async () => {
      const deps = buildDeps()
      const manager = new WorkspaceRunManager(deps)

      const result = await manager.findActive()
      expect(result).toBeNull()
    })

    it("returns the active run after startRun", async () => {
      const deps = buildDeps()
      const manager = new WorkspaceRunManager(deps)

      const startResult = await manager.startRun(makeConfig())
      expect(startResult.ok).toBe(true)

      const active = await manager.findActive()
      expect(active).not.toBeNull()
      expect(active!.status).toBe("active")
    })
  })

  describe("getActiveSystem", () => {
    it("returns null when no workspace is active", () => {
      const deps = buildDeps()
      const manager = new WorkspaceRunManager(deps)

      expect(manager.getActiveSystem()).toBeNull()
    })

    it("returns the system for the active workspace", async () => {
      const system = mockSystem()
      const deps = buildDeps({ buildSystem: jest.fn().mockResolvedValue(system) })
      const manager = new WorkspaceRunManager(deps)

      await manager.startRun(makeConfig())
      expect(manager.getActiveSystem()).toBe(system)
    })
  })

  describe("getActiveCreateGoal", () => {
    it("returns null when no workspace is active", () => {
      const deps = buildDeps()
      const manager = new WorkspaceRunManager(deps)

      expect(manager.getActiveCreateGoal()).toBeNull()
    })

    it("returns the createGoal use case from the active system", async () => {
      const system = mockSystem()
      const deps = buildDeps({ buildSystem: jest.fn().mockResolvedValue(system) })
      const manager = new WorkspaceRunManager(deps)

      await manager.startRun(makeConfig())
      const createGoal = manager.getActiveCreateGoal()
      expect(createGoal).toBe(system.dashboardDeps.createGoal)
    })
  })

  describe("stop", () => {
    it("stops and cleans up when no failures", async () => {
      const system = mockSystem()
      const isolator = createMockIsolator()
      const cleanupSpy = jest.spyOn(isolator, "cleanup")
      const deps = buildDeps({
        isolator,
        buildSystem: jest.fn().mockResolvedValue(system),
      })
      const manager = new WorkspaceRunManager(deps)

      const result = await manager.startRun(makeConfig())
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const runId = result.value

      await manager.stop(runId, false)

      expect(system.stop).toHaveBeenCalledTimes(1)
      expect(cleanupSpy).toHaveBeenCalledTimes(1)
      expect(manager.getActiveSystem()).toBeNull()

      const run = await deps.repo.findById(runId)
      expect(run).not.toBeNull()
      expect(run!.status).toBe("stopped")
      expect(run!.completedAt).not.toBeNull()
    })

    it("marks as stopped_dirty when goals failed and preserves workspace", async () => {
      const system = mockSystem()
      const isolator = createMockIsolator()
      const cleanupSpy = jest.spyOn(isolator, "cleanup")
      const deps = buildDeps({
        isolator,
        buildSystem: jest.fn().mockResolvedValue(system),
      })
      const manager = new WorkspaceRunManager(deps)

      const result = await manager.startRun(makeConfig())
      expect(result.ok).toBe(true)
      if (!result.ok) return
      const runId = result.value

      await manager.stop(runId, true)

      expect(system.stop).toHaveBeenCalledTimes(1)
      // Workspace NOT cleaned up — preserved for inspection
      expect(cleanupSpy).not.toHaveBeenCalled()

      const run = await deps.repo.findById(runId)
      expect(run!.status).toBe("stopped_dirty")
    })

    it("is a no-op for unknown run IDs", async () => {
      const deps = buildDeps()
      const manager = new WorkspaceRunManager(deps)

      // Should not throw
      await manager.stop(createWorkspaceRunId("nonexistent") as WorkspaceRunId, false)
    })
  })

  describe("cleanup", () => {
    it("rejects cleanup for non-stopped_dirty runs", async () => {
      const deps = buildDeps()
      const manager = new WorkspaceRunManager(deps)

      const result = await manager.startRun(makeConfig())
      expect(result.ok).toBe(true)
      if (!result.ok) return

      const cleanupResult = await manager.cleanup(result.value)
      expect(cleanupResult.ok).toBe(false)
    })

    it("returns failure for unknown run ID", async () => {
      const deps = buildDeps()
      const manager = new WorkspaceRunManager(deps)

      const result = await manager.cleanup(createWorkspaceRunId("nonexistent") as WorkspaceRunId)
      expect(result.ok).toBe(false)
      if (!result.ok) {
        expect(result.error).toContain("not found")
      }
    })
  })

  describe("stopAll", () => {
    it("cleans up all active handles and systems", async () => {
      const system = mockSystem()
      const isolator = createMockIsolator()
      const cleanupSpy = jest.spyOn(isolator, "cleanup")
      const deps = buildDeps({
        isolator,
        buildSystem: jest.fn().mockResolvedValue(system),
      })
      const manager = new WorkspaceRunManager(deps)

      const result = await manager.startRun(makeConfig())
      expect(result.ok).toBe(true)

      await manager.stopAll()

      expect(system.stop).toHaveBeenCalledTimes(1)
      expect(cleanupSpy).toHaveBeenCalledTimes(1)
      expect(manager.getActiveSystem()).toBeNull()
    })
  })

  describe("bus subscriptions", () => {
    it("pushes branch and creates PR on goal.completed", async () => {
      const bus = mockBus()
      const system = mockSystem(bus)
      const gitRemote = { push: jest.fn().mockResolvedValue(undefined) } as GitRemote
      const prCreator = {
        create: jest.fn().mockResolvedValue("https://github.com/test/repo/pull/1"),
        merge: jest.fn().mockResolvedValue(undefined),
      } as PullRequestCreator
      const deps = buildDeps({
        buildSystem: jest.fn().mockResolvedValue(system),
        gitRemote,
        prCreator,
        autoMerge: false,
      })
      const manager = new WorkspaceRunManager(deps)

      const result = await manager.startRun(makeConfig())
      expect(result.ok).toBe(true)
      if (!result.ok) return

      // Extract the goal.completed handler
      const subscribeCalls = (bus.subscribe as jest.Mock).mock.calls
      const completedCall = subscribeCalls.find(
        (call: any[]) => call[0].types?.includes("goal.completed"),
      )
      expect(completedCall).toBeDefined()
      const handler = completedCall![1]

      // Simulate goal.completed
      await handler({
        id: "msg-1",
        type: "goal.completed",
        goalId: "goal-1",
        costUsd: 5.0,
        timestamp: new Date(),
      })

      expect(gitRemote.push).toHaveBeenCalledTimes(1)
      expect(prCreator.create).toHaveBeenCalledTimes(1)
      expect(prCreator.merge).not.toHaveBeenCalled()
    })

    it("auto-merges PR when autoMerge is true", async () => {
      const bus = mockBus()
      const system = mockSystem(bus)
      const prCreator = {
        create: jest.fn().mockResolvedValue("https://github.com/test/repo/pull/1"),
        merge: jest.fn().mockResolvedValue(undefined),
      } as PullRequestCreator
      const deps = buildDeps({
        buildSystem: jest.fn().mockResolvedValue(system),
        prCreator,
        autoMerge: true,
      })
      const manager = new WorkspaceRunManager(deps)

      await manager.startRun(makeConfig())

      const subscribeCalls = (bus.subscribe as jest.Mock).mock.calls
      const completedCall = subscribeCalls.find(
        (call: any[]) => call[0].types?.includes("goal.completed"),
      )
      const handler = completedCall![1]

      await handler({
        id: "msg-1",
        type: "goal.completed",
        goalId: "goal-1",
        costUsd: 5.0,
        timestamp: new Date(),
      })

      expect(prCreator.merge).toHaveBeenCalledTimes(1)
    })

    it("logs error on goal.abandoned", async () => {
      const bus = mockBus()
      const system = mockSystem(bus)
      const deps = buildDeps({
        buildSystem: jest.fn().mockResolvedValue(system),
      })
      const manager = new WorkspaceRunManager(deps)

      const result = await manager.startRun(makeConfig())
      expect(result.ok).toBe(true)
      if (!result.ok) return

      const subscribeCalls = (bus.subscribe as jest.Mock).mock.calls
      const abandonedCall = subscribeCalls.find(
        (call: any[]) => call[0].types?.includes("goal.abandoned"),
      )
      expect(abandonedCall).toBeDefined()
      const handler = abandonedCall![1]

      await handler({
        id: "msg-2",
        type: "goal.abandoned",
        goalId: "goal-1",
        reason: "Budget exceeded",
        timestamp: new Date(),
      })

      const run = await deps.repo.findById(result.value)
      expect(run).not.toBeNull()
      expect(run!.error).toBe("Budget exceeded")
    })
  })
})
