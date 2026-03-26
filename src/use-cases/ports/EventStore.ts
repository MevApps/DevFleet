import type { SystemEvent } from "../../entities/Event"
import type { TaskId, GoalId } from "../../entities/ids"

export interface EventStore {
  append(event: SystemEvent): Promise<void>
  findByTaskId(taskId: TaskId): Promise<ReadonlyArray<SystemEvent>>
  findByGoalId(goalId: GoalId): Promise<ReadonlyArray<SystemEvent>>
}
