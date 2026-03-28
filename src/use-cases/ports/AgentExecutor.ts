import type { Task } from "../../entities/Task"
import type { AgentId, ProjectId } from "../../entities/ids"
import type { AgentRole } from "../../entities/AgentRole"
import type { TokenBudget } from "../../entities/Budget"
import type { AgentCapability } from "./AgentSession"

export interface AgentConfig {
  readonly role: AgentRole
  readonly systemPrompt: string
  readonly capabilities: ReadonlyArray<AgentCapability>
  readonly model: string
  readonly budget: TokenBudget
  readonly workingDir: string
}

export type AgentEventType = "turn_completed" | "text" | "task_completed" | "task_failed" | "budget_exceeded"

export interface AgentEvent {
  readonly type: AgentEventType
  readonly data: Record<string, unknown>
}

export interface AgentExecutor {
  run(agentId: AgentId, config: AgentConfig, task: Task, projectId: ProjectId): AsyncIterable<AgentEvent>
}
