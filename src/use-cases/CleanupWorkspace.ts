import type { WorkspaceRunRepository } from "./ports/WorkspaceRunRepository"
import type { WorkspaceIsolator, WorkspaceHandle } from "./ports/WorkspaceIsolator"
import type { WorkspaceRunId } from "../entities/ids"
import { createWorkspaceRun } from "../entities/WorkspaceRun"
import { type Result, success, failure } from "./Result"

export class CleanupWorkspace {
  constructor(
    private readonly repo: WorkspaceRunRepository,
    private readonly isolator: WorkspaceIsolator,
  ) {}

  async execute(runId: WorkspaceRunId, handle: WorkspaceHandle): Promise<Result<void>> {
    const run = await this.repo.findById(runId)
    if (!run) return failure(`WorkspaceRun not found: ${runId}`)
    if (run.status !== "stopped_dirty") return failure(`Can only cleanup stopped_dirty workspaces (status: ${run.status})`)

    await this.isolator.cleanup(handle)
    const stoppedRun = createWorkspaceRun({ ...run, status: "stopped", startedAt: run.startedAt })
    await this.repo.update(stoppedRun)

    return success(undefined)
  }
}
