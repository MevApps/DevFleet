import { type GoalId, type TaskId } from "./ids"
import { type TokenBudget } from "./Budget"

export type GoalStatus = "active" | "completed" | "abandoned"

export interface Goal {
  readonly id: GoalId
  readonly description: string
  readonly status: GoalStatus
  readonly createdAt: Date
  readonly completedAt: Date | null
  readonly taskIds: readonly TaskId[]
  readonly totalBudget: TokenBudget
}

export interface CreateGoalParams {
  id: GoalId
  description: string
  totalBudget: TokenBudget
  status?: GoalStatus
  createdAt?: Date
  completedAt?: Date | null
  taskIds?: readonly TaskId[]
}

export function createGoal(params: CreateGoalParams): Goal {
  return {
    id: params.id,
    description: params.description,
    totalBudget: params.totalBudget,
    status: params.status ?? "active",
    createdAt: params.createdAt ?? new Date(),
    completedAt: params.completedAt ?? null,
    taskIds: params.taskIds ?? [],
  }
}
