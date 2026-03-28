import type { WorkspaceRunRepository } from "./ports/WorkspaceRunRepository"
import type { WorkspaceIsolator, WorkspaceHandle } from "./ports/WorkspaceIsolator"
import type { WorkspaceRunId } from "../entities/ids"
import { createWorkspaceRun } from "../entities/WorkspaceRun"
import { type Result, success, failure } from "./Result"

export class StopWorkspace {
  constructor(
    private readonly repo: WorkspaceRunRepository,
    private readonly isolator: WorkspaceIsolator,
  ) {}

  async execute(runId: WorkspaceRunId, handle: WorkspaceHandle, hasFailedGoals: boolean): Promise<Result<void>> {
    const run = await this.repo.findById(runId)
    if (!run) return failure(`WorkspaceRun not found: ${runId}`)
    if (run.status !== "active") return failure(`Workspace is not active (status: ${run.status})`)

    if (hasFailedGoals) {
      const dirtyRun = createWorkspaceRun({ ...run, status: "stopped_dirty", completedAt: new Date(), startedAt: run.startedAt })
      await this.repo.update(dirtyRun)
    } else {
      await this.isolator.cleanup(handle)
      const stoppedRun = createWorkspaceRun({ ...run, status: "stopped", completedAt: new Date(), startedAt: run.startedAt })
      await this.repo.update(stoppedRun)
    }

    return success(undefined)
  }
}
