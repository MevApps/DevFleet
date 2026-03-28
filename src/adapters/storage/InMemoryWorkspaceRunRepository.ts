import type { WorkspaceRunRepository } from "../../use-cases/ports/WorkspaceRunRepository"
import type { WorkspaceRun, WorkspaceRunStatus } from "../../entities/WorkspaceRun"
import type { WorkspaceRunId } from "../../entities/ids"

export class InMemoryWorkspaceRunRepository implements WorkspaceRunRepository {
  private readonly runs = new Map<string, WorkspaceRun>()

  async create(run: WorkspaceRun): Promise<void> {
    this.runs.set(run.id, run)
  }

  async findById(id: WorkspaceRunId): Promise<WorkspaceRun | null> {
    return this.runs.get(id) ?? null
  }

  async findActive(): Promise<WorkspaceRun | null> {
    for (const run of this.runs.values()) {
      if (run.status === "active" || run.status === "cloning" || run.status === "installing" || run.status === "detecting") {
        return run
      }
    }
    return null
  }

  async findByStatus(status: WorkspaceRunStatus): Promise<WorkspaceRun | null> {
    for (const run of this.runs.values()) {
      if (run.status === status) return run
    }
    return null
  }

  async update(run: WorkspaceRun): Promise<void> {
    this.runs.set(run.id, run)
  }
}
