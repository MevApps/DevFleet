import { type AgentId, type TaskId, type GoalId } from "./ids"

export interface Metric {
  readonly name: string
  readonly value: number
  readonly unit: string
  readonly agentId: AgentId | null
  readonly taskId: TaskId | null
  readonly goalId: GoalId | null
  readonly recordedAt: Date
  readonly tags: Record<string, string>
}
