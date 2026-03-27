import type { Message } from "../../entities/Message"
import type { SystemEvent } from "../../entities/Event"
import type { AgentId, GoalId, TaskId } from "../../entities/ids"
import { createEventId } from "../../entities/ids"

export function toSystemEvent(message: Message): SystemEvent {
  const agentId = "agentId" in message ? (message as { agentId: AgentId }).agentId : null
  const taskId = "taskId" in message ? (message as { taskId: TaskId }).taskId : null
  const goalId = "goalId" in message ? (message as { goalId: GoalId }).goalId : null

  return {
    id: createEventId(),
    type: message.type,
    agentId,
    taskId,
    goalId,
    cost: null,
    occurredAt: message.timestamp,
    payload: message,
  }
}
