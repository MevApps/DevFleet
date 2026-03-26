import { type AgentId, type TaskId } from "./ids"

export interface ExperimentResult {
  readonly id: string
  readonly agentId: AgentId
  readonly taskId: TaskId
  readonly hypothesis: string
  readonly outcome: "success" | "failure" | "inconclusive"
  readonly metrics: Record<string, number>
  readonly notes: string
  readonly createdAt: Date
}
