import type { SystemEvent } from "../../entities/Event"
import type { TaskId, GoalId, AgentId } from "../../entities/ids"
import type { MessageType } from "../../entities/Message"

export interface EventQueryOptions {
  readonly types?: readonly MessageType[]
  readonly agentId?: AgentId
  readonly limit?: number
  readonly offset?: number
}

export interface EventStore {
  append(event: SystemEvent): Promise<void>
  findByTaskId(taskId: TaskId): Promise<ReadonlyArray<SystemEvent>>
  findByGoalId(goalId: GoalId): Promise<ReadonlyArray<SystemEvent>>
  findAll(options?: EventQueryOptions): Promise<ReadonlyArray<SystemEvent>>
  findRecent(limit: number): Promise<ReadonlyArray<SystemEvent>>
  countAll(): Promise<number>
}
