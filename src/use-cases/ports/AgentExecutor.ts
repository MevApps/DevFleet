import type { Task } from "../../entities/Task"
import type { AgentId, ProjectId } from "../../entities/ids"
import type { AgentRole } from "../../entities/AgentRole"
import type { TokenBudget } from "../../entities/Budget"
import type { ToolDefinition } from "./AIProvider"
import type { AgentCapability } from "./AgentSession"

export interface AgentConfig {
  readonly role: AgentRole
  readonly systemPrompt: string
  /** @deprecated Prefer capabilities + workingDir for session-based executors */
  readonly tools?: ReadonlyArray<ToolDefinition>
  readonly capabilities?: ReadonlyArray<AgentCapability>
  readonly workingDir?: string
  readonly model: string
  readonly budget: TokenBudget
}

export type AgentEventType = "turn_completed" | "tool_executed" | "task_completed" | "task_failed" | "budget_exceeded" | "text"

export interface AgentEvent {
  readonly type: AgentEventType
  readonly data: Record<string, unknown>
}

export interface AgentExecutor {
  run(agentId: AgentId, config: AgentConfig, task: Task, projectId: ProjectId): AsyncIterable<AgentEvent>
}
