import type { GoalId } from "../entities/ids"
import type { TaskRepository } from "./ports/TaskRepository"
import type { ArtifactRepository } from "./ports/ArtifactRepository"
import type { ArtifactChain, PhaseArtifact } from "./ports/ArtifactChain"

export class GoalArtifactChain implements ArtifactChain {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly artifacts: ArtifactRepository,
    private readonly phases: readonly string[],
  ) {}

  async gather(goalId: GoalId): Promise<readonly PhaseArtifact[]> {
    const allTasks = await this.tasks.findByGoalId(goalId)

    const completed = allTasks
      .filter(t => t.status === "completed" || t.status === "merged")
      .filter(t => t.artifacts.length > 0)
      .sort((a, b) => this.phases.indexOf(a.phase) - this.phases.indexOf(b.phase))

    const result: PhaseArtifact[] = []

    for (const task of completed) {
      for (const artifactId of task.artifacts) {
        const artifact = await this.artifacts.findById(artifactId)
        if (artifact) {
          result.push({
            phase: task.phase,
            kind: artifact.kind,
            content: artifact.content,
          })
        }
      }
    }

    return result
  }
}
