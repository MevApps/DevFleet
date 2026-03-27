import type { EventStore } from "./ports/EventStore"
import type { MetricsFilter } from "../entities/MetricsFilter"
import type { FinancialsReport } from "../entities/Reports"
import type { GoalId } from "../entities/ids"

export class ComputeFinancials {
  constructor(private readonly events: EventStore) {}

  async execute(filter?: MetricsFilter): Promise<FinancialsReport> {
    const allEvents = await this.events.findAll()
    const filtered = allEvents.filter(e => {
      if (!e.cost) return false
      if (filter?.goalId && e.goalId !== filter.goalId) return false
      if (filter?.agentId && e.agentId !== filter.agentId) return false
      if (filter?.since && e.occurredAt < filter.since) return false
      if (filter?.until && e.occurredAt > filter.until) return false
      return true
    })

    let totalTokensUsed = 0
    let totalCostUsd = 0
    const costByGoal = new Map<string, number>()
    const tokensByAgent = new Map<string, number>()

    for (const event of filtered) {
      if (!event.cost) continue
      totalTokensUsed += event.cost.totalTokens
      totalCostUsd += event.cost.estimatedCostUsd
      if (event.goalId) {
        costByGoal.set(event.goalId, (costByGoal.get(event.goalId) ?? 0) + event.cost.estimatedCostUsd)
      }
      if (event.agentId) {
        const key = event.agentId as string
        tokensByAgent.set(key, (tokensByAgent.get(key) ?? 0) + event.cost.totalTokens)
      }
    }

    const costPerGoal = [...costByGoal.entries()].map(([goalId, costUsd]) => ({ goalId: goalId as GoalId, costUsd }))
    const agentTokenBreakdown: Record<string, number> = Object.fromEntries(tokensByAgent)

    return { totalTokensUsed, totalCostUsd, costPerGoal, agentTokenBreakdown, modelTierBreakdown: {} }
  }
}
