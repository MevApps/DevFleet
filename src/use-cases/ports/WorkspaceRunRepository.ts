import type { WorkspaceRun, WorkspaceRunStatus } from "../../entities/WorkspaceRun"
import type { WorkspaceRunId } from "../../entities/ids"

export interface WorkspaceRunRepository {
  create(run: WorkspaceRun): Promise<void>
  findById(id: WorkspaceRunId): Promise<WorkspaceRun | null>
  findActive(): Promise<WorkspaceRun | null>
  findByStatus(status: WorkspaceRunStatus): Promise<WorkspaceRun | null>
  update(run: WorkspaceRun): Promise<void>
}
