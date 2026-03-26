import type { TaskId } from "../entities/ids"
import type { TaskRepository } from "./ports/TaskRepository"
import { success, failure, type Result } from "./Result"

export interface BudgetCheckResult {
  readonly canProceed: boolean
  readonly remaining: number
  readonly estimatedCost: number
}

export class CheckBudget {
  constructor(private readonly tasks: TaskRepository) {}

  async execute(taskId: TaskId, estimatedTokens: number): Promise<Result<BudgetCheckResult>> {
    const task = await this.tasks.findById(taskId)
    if (!task) {
      return failure(`Task ${taskId} not found`)
    }

    const remaining = task.budget.maxTokens - task.tokensUsed
    const canProceed = estimatedTokens <= remaining

    return success({
      canProceed,
      remaining,
      estimatedCost: estimatedTokens,
    })
  }
}
