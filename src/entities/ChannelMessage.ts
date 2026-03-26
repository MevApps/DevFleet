import { type MessageId, type TaskId, type AgentId, createMessageId } from "./ids"

export interface ChannelMessage {
  readonly id: MessageId
  readonly taskId: TaskId | null
  readonly from: AgentId
  readonly to: AgentId | "all"
  readonly content: string
  readonly replyTo: MessageId | null
  readonly timestamp: Date
}

export interface CreateChannelMessageParams {
  from: AgentId
  to: AgentId | "all"
  content: string
  taskId?: TaskId | null
  replyTo?: MessageId | null
  id?: MessageId
  timestamp?: Date
}

export function createChannelMessage(params: CreateChannelMessageParams): ChannelMessage {
  return {
    id: params.id ?? createMessageId(),
    taskId: params.taskId ?? null,
    from: params.from,
    to: params.to,
    content: params.content,
    replyTo: params.replyTo ?? null,
    timestamp: params.timestamp ?? new Date(),
  }
}
