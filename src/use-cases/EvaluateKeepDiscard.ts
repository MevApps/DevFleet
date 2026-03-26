import type { TaskId } from "../entities/ids"
import type { TaskRepository } from "./ports/TaskRepository"
import { success, failure, type Result } from "./Result"

export type KeepDiscardDecision = "keep" | "retry" | "discard"

export class EvaluateKeepDiscard {
  constructor(private readonly tasks: TaskRepository) {}

  async execute(
    taskId: TaskId,
    verdict: "approved" | "rejected",
    maxRetries: number,
  ): Promise<Result<KeepDiscardDecision>> {
    const task = await this.tasks.findById(taskId)
    if (!task) {
      return failure(`Task ${taskId} not found`)
    }

    if (verdict === "approved") {
      return success("keep")
    }

    // Rejected — check retries
    if (task.retryCount < maxRetries) {
      const updated = { ...task, retryCount: task.retryCount + 1, version: task.version + 1 }
      await this.tasks.update(updated)
      return success("retry")
    }

    return success("discard")
  }
}
