import type { Task } from "../../entities/Task"
import type { TaskId, GoalId } from "../../entities/ids"

export class VersionConflictError extends Error {
  constructor(public readonly taskId: TaskId, public readonly expectedVersion: number) {
    super(`Version conflict for task ${taskId} at version ${expectedVersion}`)
    this.name = "VersionConflictError"
  }
}

export interface TaskRepository {
  findById(id: TaskId): Promise<Task | null>
  findByGoalId(goalId: GoalId): Promise<ReadonlyArray<Task>>
  create(task: Task): Promise<void>
  update(task: Task): Promise<void>
}
