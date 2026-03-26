import type { Artifact } from "../../entities/Artifact"
import type { ArtifactId, TaskId } from "../../entities/ids"
import type { ArtifactRepository } from "../../use-cases/ports/ArtifactRepository"

export class InMemoryArtifactRepo implements ArtifactRepository {
  private readonly store = new Map<string, Artifact>()

  async findById(id: ArtifactId): Promise<Artifact | null> {
    return this.store.get(id) ?? null
  }

  async findByTaskId(taskId: TaskId): Promise<ReadonlyArray<Artifact>> {
    return [...this.store.values()].filter(a => a.taskId === taskId)
  }

  async create(artifact: Artifact): Promise<void> {
    this.store.set(artifact.id, artifact)
  }
}
