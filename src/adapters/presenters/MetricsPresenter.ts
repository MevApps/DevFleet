import type { TaskRepository } from "../../use-cases/ports/TaskRepository"
import type { EventStore } from "../../use-cases/ports/EventStore"
import type { MetricsSummaryDTO } from "./dto"

export class MetricsPresenter {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly events: EventStore,
  ) {}

  async present(): Promise<MetricsSummaryDTO> {
    const [allTasks, allEvents] = await Promise.all([this.tasks.findAll(), this.events.findAll()])
    let totalTokensUsed = 0, totalCostUsd = 0, activeTaskCount = 0, completedTaskCount = 0
    for (const task of allTasks) {
      totalTokensUsed += task.tokensUsed
      if (task.status === "in_progress" || task.status === "review") activeTaskCount++
      if (task.status === "merged") completedTaskCount++
    }
    const agentTokenBreakdown: Record<string, number> = {}
    for (const event of allEvents) {
      if (event.cost) {
        totalCostUsd += event.cost.estimatedCostUsd
        if (event.agentId) {
          const key = event.agentId as string
          agentTokenBreakdown[key] = (agentTokenBreakdown[key] ?? 0) + event.cost.totalTokens
        }
      }
    }
    return { totalTokensUsed, totalCostUsd, activeTaskCount, completedTaskCount, agentTokenBreakdown }
  }
}
