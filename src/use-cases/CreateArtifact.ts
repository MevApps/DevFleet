import type { Artifact } from "../entities/Artifact"
import type { ArtifactRepository } from "./ports/ArtifactRepository"
import type { TaskRepository } from "./ports/TaskRepository"
import { success, failure, type Result } from "./Result"

export class CreateArtifactUseCase {
  constructor(
    private readonly artifacts: ArtifactRepository,
    private readonly tasks: TaskRepository,
  ) {}

  async execute(artifact: Artifact): Promise<Result<void>> {
    const task = await this.tasks.findById(artifact.taskId)
    if (!task) {
      return failure(`Task ${artifact.taskId} not found`)
    }

    await this.artifacts.create(artifact)

    const updated = {
      ...task,
      artifacts: [...task.artifacts, artifact.id],
      version: task.version + 1,
    }
    await this.tasks.update(updated)

    return success(undefined)
  }
}
