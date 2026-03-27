import type { KeepDiscardRecord } from "../../entities/KeepDiscardRecord"
import type { AgentId, GoalId } from "../../entities/ids"

export interface KeepDiscardRepository {
  save(record: KeepDiscardRecord): Promise<void>
  findByAgentId(agentId: AgentId): Promise<ReadonlyArray<KeepDiscardRecord>>
  findByGoalId(goalId: GoalId): Promise<ReadonlyArray<KeepDiscardRecord>>
  findAll(): Promise<ReadonlyArray<KeepDiscardRecord>>
}
