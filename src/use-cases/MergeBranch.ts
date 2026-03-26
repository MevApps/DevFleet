import type { TaskId } from "../entities/ids"
import { createMessageId } from "../entities/ids"
import type { TaskRepository } from "./ports/TaskRepository"
import type { WorktreeManager } from "./ports/WorktreeManager"
import type { MessagePort } from "./ports/MessagePort"
import { success, failure, type Result } from "./Result"

export class MergeBranch {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly worktree: WorktreeManager,
    private readonly bus: MessagePort,
  ) {}

  async execute(taskId: TaskId): Promise<Result<string>> {
    const task = await this.tasks.findById(taskId)
    if (!task) return failure(`Task ${taskId} not found`)
    if (!task.branch) return failure(`Task ${taskId} has no branch`)

    const mergeResult = await this.worktree.merge(task.branch)
    if (!mergeResult.success) {
      return failure(`Merge failed: ${mergeResult.error}`)
    }

    const updated = { ...task, status: "merged" as const, version: task.version + 1 }
    await this.tasks.update(updated)

    await this.bus.emit({
      id: createMessageId(),
      type: "branch.merged",
      taskId,
      branch: task.branch,
      commit: mergeResult.commit,
      timestamp: new Date(),
    })

    return success(mergeResult.commit)
  }
}
