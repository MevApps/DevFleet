import type { WorkspaceRunRepository } from "./ports/WorkspaceRunRepository"
import type { WorkspaceRun } from "../entities/WorkspaceRun"
import type { WorkspaceRunId } from "../entities/ids"
import { type Result, success, failure } from "./Result"

export interface WorkspaceRunStatusDTO {
  readonly run: WorkspaceRun
}

export class GetWorkspaceRunStatus {
  constructor(
    private readonly repo: WorkspaceRunRepository,
  ) {}

  async execute(runId: WorkspaceRunId): Promise<Result<WorkspaceRunStatusDTO>> {
    const run = await this.repo.findById(runId)
    if (!run) return failure(`WorkspaceRun not found: ${runId}`)
    return success({ run })
  }
}
