import type { KeepDiscardRecord } from "../../entities/KeepDiscardRecord"
import type { AgentId, GoalId } from "../../entities/ids"
import type { KeepDiscardRepository } from "../../use-cases/ports/KeepDiscardRepository"

export class InMemoryKeepDiscardRepository implements KeepDiscardRepository {
  private readonly records: KeepDiscardRecord[] = []

  async save(record: KeepDiscardRecord): Promise<void> {
    this.records.push(record)
  }

  async findByAgentId(agentId: AgentId): Promise<ReadonlyArray<KeepDiscardRecord>> {
    return this.records.filter(r => r.agentId === agentId)
  }

  async findByGoalId(goalId: GoalId): Promise<ReadonlyArray<KeepDiscardRecord>> {
    return this.records.filter(r => r.goalId === goalId)
  }

  async findAll(): Promise<ReadonlyArray<KeepDiscardRecord>> {
    return [...this.records]
  }
}
