import type { TaskId } from "../entities/ids"
import { createMessageId } from "../entities/ids"
import type { TaskRepository } from "./ports/TaskRepository"
import type { WorktreeManager } from "./ports/WorktreeManager"
import type { MessagePort } from "./ports/MessagePort"
import { success, failure, type Result } from "./Result"

export class DiscardBranch {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly worktree: WorktreeManager,
    private readonly bus: MessagePort,
  ) {}

  async execute(taskId: TaskId, reason: string): Promise<Result<void>> {
    const task = await this.tasks.findById(taskId)
    if (!task) return failure(`Task ${taskId} not found`)
    if (!task.branch) return failure(`Task ${taskId} has no branch`)

    await this.worktree.delete(task.branch)

    const updated = { ...task, status: "discarded" as const, version: task.version + 1 }
    await this.tasks.update(updated)

    await this.bus.emit({
      id: createMessageId(),
      type: "branch.discarded",
      taskId,
      branch: task.branch,
      reason,
      timestamp: new Date(),
    })

    return success(undefined)
  }
}
