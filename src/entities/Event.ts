import { type EventId, type AgentId, type TaskId, type GoalId } from "./ids"
import { type MessageType } from "./Message"

export interface EventCost {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly totalTokens: number
  readonly estimatedCostUsd: number
}

export interface SystemEvent {
  readonly id: EventId
  readonly type: MessageType
  readonly agentId: AgentId | null
  readonly taskId: TaskId | null
  readonly goalId: GoalId | null
  readonly cost: EventCost | null
  readonly occurredAt: Date
  readonly payload: unknown
}
