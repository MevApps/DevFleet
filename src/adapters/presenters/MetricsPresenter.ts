import type { TaskRepository } from "../../use-cases/ports/TaskRepository"
import type { ComputeFinancials } from "../../use-cases/ComputeFinancials"
import type { MetricsSummaryDTO } from "./dto"

export class MetricsPresenter {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly computeFinancials: ComputeFinancials,
  ) {}

  async present(): Promise<MetricsSummaryDTO> {
    const [allTasks, financials] = await Promise.all([this.tasks.findAll(), this.computeFinancials.execute()])
    let activeTaskCount = 0, completedTaskCount = 0
    for (const task of allTasks) {
      if (task.status === "in_progress" || task.status === "review") activeTaskCount++
      if (task.status === "merged") completedTaskCount++
    }
    return {
      totalTokensUsed: financials.totalTokensUsed,
      totalCostUsd: financials.totalCostUsd,
      activeTaskCount,
      completedTaskCount,
      agentTokenBreakdown: financials.agentTokenBreakdown,
    }
  }
}
