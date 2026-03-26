import type { GoalId, TaskId } from "../entities/ids"
import type { TokenBudget } from "../entities/Budget"
import type { GoalRepository } from "./ports/GoalRepository"
import type { TaskRepository } from "./ports/TaskRepository"
import type { MessagePort } from "./ports/MessagePort"
import { success, failure, type Result } from "./Result"
import { createTask } from "../entities/Task"
import { createMessageId } from "../entities/ids"

export interface TaskDefinition {
  readonly id: TaskId
  readonly description: string
  readonly phase: string
  readonly budget: TokenBudget
  readonly parentTaskId?: TaskId | null
}

export class DecomposeGoal {
  constructor(
    private readonly goals: GoalRepository,
    private readonly tasks: TaskRepository,
    private readonly bus: MessagePort,
  ) {}

  async execute(goalId: GoalId, defs: ReadonlyArray<TaskDefinition>): Promise<Result<void>> {
    const goal = await this.goals.findById(goalId)
    if (!goal) {
      return failure(`Goal ${goalId} not found`)
    }

    if (goal.status !== "active") {
      return failure(`Goal ${goalId} is not active (status: ${goal.status})`)
    }

    const newTasks = defs.map(def =>
      createTask({
        id: def.id,
        goalId,
        description: def.description,
        phase: def.phase,
        budget: def.budget,
        parentTaskId: def.parentTaskId ?? null,
      })
    )

    for (const task of newTasks) {
      await this.tasks.create(task)
    }

    const updatedGoal = {
      ...goal,
      taskIds: [...goal.taskIds, ...newTasks.map(t => t.id)],
    }
    await this.goals.update(updatedGoal)

    for (const task of newTasks) {
      await this.bus.emit({
        id: createMessageId(),
        type: "task.created",
        taskId: task.id,
        goalId,
        description: task.description,
        timestamp: new Date(),
      })
    }

    return success(undefined)
  }
}
