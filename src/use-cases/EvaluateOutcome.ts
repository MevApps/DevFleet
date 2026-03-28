import type { TaskId } from "../entities/ids"
import type { TaskRepository } from "./ports/TaskRepository"
import type { MessagePort } from "./ports/MessagePort"
import { success, failure, type Result } from "./Result"
import { isOverBudget } from "../entities/Task"
import { createMessageId } from "../entities/ids"

export type SessionOutcomeType = "success" | "failure" | "budget_exceeded"

export interface SessionOutcome {
  readonly outcome: SessionOutcomeType
  readonly reason?: string
}

export interface EvaluateOutcomeInput {
  readonly result: string
  readonly numTurns: number
}

export class EvaluateOutcome {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly bus: MessagePort,
  ) {}

  async execute(taskId: TaskId, _input: EvaluateOutcomeInput): Promise<Result<SessionOutcome>> {
    const task = await this.tasks.findById(taskId)
    if (!task) {
      return failure(`Task ${taskId} not found`)
    }

    if (isOverBudget(task)) {
      if (task.assignedTo) {
        await this.bus.emit({
          id: createMessageId(),
          type: "budget.exceeded",
          taskId,
          agentId: task.assignedTo,
          tokensUsed: task.tokensUsed,
          budgetMax: task.budget.maxTokens,
          timestamp: new Date(),
        })
      }
      return success({ outcome: "budget_exceeded", reason: "Token budget exceeded" })
    }

    return success({ outcome: "success" })
  }
}
