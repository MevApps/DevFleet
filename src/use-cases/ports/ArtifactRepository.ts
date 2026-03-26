import type { Artifact } from "../../entities/Artifact"
import type { ArtifactId, TaskId } from "../../entities/ids"

export interface ArtifactRepository {
  findById(id: ArtifactId): Promise<Artifact | null>
  findByTaskId(taskId: TaskId): Promise<ReadonlyArray<Artifact>>
  create(artifact: Artifact): Promise<void>
}
