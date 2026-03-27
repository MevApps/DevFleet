import type { GoalId, AgentId } from "./ids"

export interface MetricsFilter {
  readonly goalId?: GoalId
  readonly agentId?: AgentId
  readonly since?: Date
  readonly until?: Date
}
