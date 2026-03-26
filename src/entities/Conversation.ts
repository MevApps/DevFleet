import { type AgentId } from "./ids"

export type TurnRole = "user" | "assistant" | "system"

export interface ConversationTurn {
  readonly role: TurnRole
  readonly content: string
  readonly tokenCount: number
  readonly timestamp: Date
}

export interface Conversation {
  readonly agentId: AgentId
  readonly turns: readonly ConversationTurn[]
  readonly totalTokens: number
  readonly createdAt: Date
  readonly updatedAt: Date
}

export function createConversation(agentId: AgentId): Conversation {
  const now = new Date()
  return {
    agentId,
    turns: [],
    totalTokens: 0,
    createdAt: now,
    updatedAt: now,
  }
}

export function addTurn(conversation: Conversation, turn: ConversationTurn): Conversation {
  return {
    ...conversation,
    turns: [...conversation.turns, turn],
    totalTokens: conversation.totalTokens + turn.tokenCount,
    updatedAt: new Date(),
  }
}
