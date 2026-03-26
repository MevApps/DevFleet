import type { Task } from "../../entities/Task"
import type { TaskId, GoalId } from "../../entities/ids"
import type { TaskRepository } from "../../use-cases/ports/TaskRepository"
import { VersionConflictError } from "../../use-cases/ports/TaskRepository"

export class InMemoryTaskRepo implements TaskRepository {
  private readonly store = new Map<string, Task>()

  async findById(id: TaskId): Promise<Task | null> {
    return this.store.get(id) ?? null
  }

  async findByGoalId(goalId: GoalId): Promise<ReadonlyArray<Task>> {
    const results: Task[] = []
    for (const task of this.store.values()) {
      if (task.goalId === goalId) {
        results.push(task)
      }
    }
    return results
  }

  async create(task: Task): Promise<void> {
    this.store.set(task.id, task)
  }

  async update(task: Task): Promise<void> {
    const stored = this.store.get(task.id)
    if (!stored) {
      throw new Error(`Task ${task.id} not found`)
    }
    if (stored.version !== task.version - 1) {
      throw new VersionConflictError(task.id, task.version)
    }
    this.store.set(task.id, task)
  }
}
