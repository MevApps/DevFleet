import { type AgentId, type TaskId } from "./ids"
import { type AgentRole } from "./AgentRole"

export type AgentStatus = "idle" | "busy" | "blocked" | "paused" | "stopped"

export interface Agent {
  readonly id: AgentId
  readonly role: AgentRole
  readonly status: AgentStatus
  readonly currentTaskId: TaskId | null
  readonly model: string
  readonly lastActiveAt: Date
}

export interface CreateAgentParams {
  id: AgentId
  role: AgentRole
  model: string
  status?: AgentStatus
  currentTaskId?: TaskId | null
  lastActiveAt?: Date
}

export function createAgent(params: CreateAgentParams): Agent {
  return {
    id: params.id,
    role: params.role,
    model: params.model,
    status: params.status ?? "idle",
    currentTaskId: params.currentTaskId ?? null,
    lastActiveAt: params.lastActiveAt ?? new Date(),
  }
}

export function isAvailable(agent: Agent): boolean {
  return agent.status === "idle" && agent.currentTaskId === null
}
