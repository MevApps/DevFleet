import type { WorkspaceRunRepository } from "./ports/WorkspaceRunRepository"
import type { WorkspaceIsolator, WorkspaceHandle } from "./ports/WorkspaceIsolator"
import type { FileSystemFactory } from "./ports/FileSystem"
import type { GitRemote } from "./ports/GitRemote"
import type { PullRequestCreator } from "./ports/PullRequestCreator"
import type { Unsubscribe } from "./ports/MessagePort"
import type { WorkspaceRunId } from "../entities/ids"
import type { WorkspaceRunConfig, WorkspaceRun } from "../entities/WorkspaceRun"
import type { DevFleetSystem, DevFleetConfig } from "../infrastructure/config/composition-root"
import type { CreateGoalFromCeo } from "./CreateGoalFromCeo"
import { createWorkspaceRunId, createMessageId } from "../entities/ids"
import { createWorkspaceRun } from "../entities/WorkspaceRun"
import { DetectProjectConfig } from "./DetectProjectConfig"
import { success, failure, type Result } from "./Result"

// ---------------------------------------------------------------------------
// Dependencies — injected to respect the dependency rule (Layer 2 can't
// import Layer 4 constructors, but can receive them as functions).
// ---------------------------------------------------------------------------
export interface WorkspaceRunManagerDeps {
  readonly repo: WorkspaceRunRepository
  readonly isolator: WorkspaceIsolator
  readonly fsFactory: FileSystemFactory
  readonly gitRemote: GitRemote
  readonly prCreator: PullRequestCreator
  readonly autoMerge: boolean
  readonly buildSystem: (config: DevFleetConfig) => Promise<DevFleetSystem>
  readonly mockMode?: boolean
}

// ---------------------------------------------------------------------------
// Internal bookkeeping per active run
// ---------------------------------------------------------------------------
interface ActiveRunEntry {
  readonly handle: WorkspaceHandle
  readonly system: DevFleetSystem
  readonly cloneDir: string
  readonly unsubscribes: Unsubscribe[]
}

const BRANCH_PREFIX = "devfleet/workspace-"

// ---------------------------------------------------------------------------
// WorkspaceRunManager — central orchestrator for workspace lifecycle
// ---------------------------------------------------------------------------
export class WorkspaceRunManager {
  private readonly runs = new Map<string, ActiveRunEntry>()

  constructor(private readonly deps: WorkspaceRunManagerDeps) {}

  // -----------------------------------------------------------------------
  // startRun: clone -> detect -> install -> build system -> start -> subscribe
  // -----------------------------------------------------------------------
  async startRun(config: WorkspaceRunConfig): Promise<Result<WorkspaceRunId>> {
    const existing = await this.deps.repo.findActive()
    if (existing) {
      return failure("A workspace run is already active")
    }

    const runId = createWorkspaceRunId()
    let run = createWorkspaceRun({ id: runId, config, status: "created" })
    await this.deps.repo.create(run)

    try {
      // Clone
      run = createWorkspaceRun({ ...run, status: "cloning" })
      await this.deps.repo.update(run)
      const handle = await this.deps.isolator.create(config.repoUrl)
      const cloneDir = this.deps.isolator.getWorkspaceDir(handle)

      // Detect project config
      run = createWorkspaceRun({ ...run, status: "detecting" })
      await this.deps.repo.update(run)
      const scopedFs = this.deps.fsFactory(cloneDir)
      const detector = new DetectProjectConfig(scopedFs)
      const projectConfig = await detector.execute()

      // Install dependencies
      run = createWorkspaceRun({ ...run, status: "installing", projectConfig })
      await this.deps.repo.update(run)
      if (projectConfig.installCommand) {
        await this.deps.isolator.installDependencies(handle, projectConfig.installCommand)
      }

      // Build the DevFleet system scoped to the clone directory
      const systemConfig: DevFleetConfig = {
        workspaceDir: cloneDir,
        mockMode: this.deps.mockMode,
        supervisorModel: config.supervisorModel,
        developerModel: config.developerModel,
        reviewerModel: config.reviewerModel,
        pipelineTimeoutMs: config.timeoutMs,
        buildCommand: projectConfig.buildCommand,
        testCommand: projectConfig.testCommand,
      }
      const system = await this.deps.buildSystem(systemConfig)
      await system.start()

      // Subscribe to bus for goal lifecycle events
      const unsubscribes = this.subscribeToBus(runId, system, config, cloneDir)

      // Track the active run
      this.runs.set(runId, { handle, system, cloneDir, unsubscribes })

      run = createWorkspaceRun({ ...run, status: "active" })
      await this.deps.repo.update(run)

      return success(runId)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      run = createWorkspaceRun({ ...run, status: "failed", error: message })
      await this.deps.repo.update(run)
      return failure(message)
    }
  }

  // -----------------------------------------------------------------------
  // Queries
  // -----------------------------------------------------------------------
  async findActive(): Promise<WorkspaceRun | null> {
    return this.deps.repo.findActive()
  }

  getActiveSystem(): DevFleetSystem | null {
    for (const entry of this.runs.values()) {
      return entry.system
    }
    return null
  }

  getActiveCreateGoal(): CreateGoalFromCeo | null {
    const system = this.getActiveSystem()
    if (!system) return null
    return system.dashboardDeps.createGoal
  }

  // -----------------------------------------------------------------------
  // stop: shut down a run, optionally preserving workspace for inspection
  // -----------------------------------------------------------------------
  async stop(runId: WorkspaceRunId, hasFailedGoals: boolean): Promise<void> {
    const entry = this.runs.get(runId)
    if (!entry) return

    // Unsubscribe from bus events
    for (const unsub of entry.unsubscribes) {
      unsub()
    }

    await entry.system.stop()

    const status = hasFailedGoals ? "stopped_dirty" : "stopped"
    const run = await this.deps.repo.findById(runId)
    if (run) {
      await this.deps.repo.update(
        createWorkspaceRun({ ...run, status, completedAt: new Date() }),
      )
    }

    if (!hasFailedGoals) {
      await entry.handle && this.deps.isolator.cleanup(entry.handle)
    }

    this.runs.delete(runId)
  }

  // -----------------------------------------------------------------------
  // cleanup: remove workspace files for stopped_dirty runs
  // -----------------------------------------------------------------------
  async cleanup(runId: WorkspaceRunId): Promise<Result<void>> {
    const run = await this.deps.repo.findById(runId)
    if (!run) return failure("Run not found")
    if (run.status !== "stopped_dirty") {
      return failure("Can only cleanup stopped_dirty runs")
    }

    // The entry may already be removed from the in-memory map after stop().
    // The isolator cleanup is idempotent — re-create a minimal handle for it.
    const entry = this.runs.get(runId)
    if (entry) {
      await this.deps.isolator.cleanup(entry.handle)
      this.runs.delete(runId)
    }

    await this.deps.repo.update(
      createWorkspaceRun({ ...run, status: "stopped", completedAt: run.completedAt ?? new Date() }),
    )
    return success(undefined)
  }

  // -----------------------------------------------------------------------
  // stopAll: graceful shutdown of every active workspace
  // -----------------------------------------------------------------------
  async stopAll(): Promise<void> {
    const entries = Array.from(this.runs.entries())
    for (const [runId, entry] of entries) {
      for (const unsub of entry.unsubscribes) {
        unsub()
      }
      await entry.system.stop()
      await this.deps.isolator.cleanup(entry.handle)
      this.runs.delete(runId)
    }
  }

  // -----------------------------------------------------------------------
  // subscribeToBus: listen for goal.completed and goal.abandoned
  // -----------------------------------------------------------------------
  private subscribeToBus(
    runId: WorkspaceRunId,
    system: DevFleetSystem,
    config: WorkspaceRunConfig,
    cloneDir: string,
  ): Unsubscribe[] {
    const branch = `${BRANCH_PREFIX}${runId}`

    const unsubCompleted = system.bus.subscribe(
      { types: ["goal.completed"] },
      async (message) => {
        if (message.type !== "goal.completed") return
        try {
          await this.deps.gitRemote.push(branch, config.repoUrl, cloneDir)
          const prUrl = await this.deps.prCreator.create({
            repoUrl: config.repoUrl,
            branch,
            baseBranch: "main",
            title: `[DevFleet] workspace ${runId}`,
            body: `Auto-generated by DevFleet workspace run ${runId}`,
            workingDir: cloneDir,
          })

          if (this.deps.autoMerge) {
            await this.deps.prCreator.merge(prUrl, cloneDir)
          }

          await system.bus.emit({
            id: createMessageId(),
            type: "workspace.goal.delivered",
            goalId: message.goalId,
            prUrl,
            merged: this.deps.autoMerge,
            timestamp: new Date(),
          })
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err)
          await system.bus.emit({
            id: createMessageId(),
            type: "workspace.goal.failed",
            goalId: message.goalId,
            reason,
            timestamp: new Date(),
          })
        }
      },
    )

    const unsubAbandoned = system.bus.subscribe(
      { types: ["goal.abandoned"] },
      async (message) => {
        if (message.type !== "goal.abandoned") return
        const run = await this.deps.repo.findById(runId)
        if (run) {
          await this.deps.repo.update(
            createWorkspaceRun({ ...run, error: message.reason }),
          )
        }
      },
    )

    return [unsubCompleted, unsubAbandoned]
  }
}
