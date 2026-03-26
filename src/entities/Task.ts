import { type TaskId, type GoalId, type AgentId, type ArtifactId } from "./ids"
import { type TokenBudget } from "./Budget"

export type TaskStatus =
  | "queued"
  | "in_progress"
  | "review"
  | "approved"
  | "merged"
  | "discarded"

export interface Task {
  readonly id: TaskId
  readonly goalId: GoalId
  readonly description: string
  readonly status: TaskStatus
  readonly phase: string
  readonly assignedTo: AgentId | null
  readonly budget: TokenBudget
  readonly tokensUsed: number
  readonly version: number
  readonly artifacts: readonly ArtifactId[]
  readonly parentTaskId: TaskId | null
}

// Terminal states have no outgoing transitions
export const ALLOWED_TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  queued: ["in_progress", "discarded"],
  in_progress: ["review", "discarded"],
  review: ["approved", "in_progress", "discarded"],
  approved: ["merged", "discarded"],
  merged: [],
  discarded: [],
}

export function canTransition(task: Task, to: TaskStatus): boolean {
  return (ALLOWED_TRANSITIONS[task.status] as readonly TaskStatus[]).includes(to)
}

export function isOverBudget(task: Task): boolean {
  return task.tokensUsed > task.budget.maxTokens
}

export interface CreateTaskParams {
  id: TaskId
  goalId: GoalId
  description: string
  phase: string
  budget: TokenBudget
  status?: TaskStatus
  assignedTo?: AgentId | null
  tokensUsed?: number
  version?: number
  artifacts?: readonly ArtifactId[]
  parentTaskId?: TaskId | null
}

export function createTask(params: CreateTaskParams): Task {
  return {
    id: params.id,
    goalId: params.goalId,
    description: params.description,
    phase: params.phase,
    budget: params.budget,
    status: params.status ?? "queued",
    assignedTo: params.assignedTo ?? null,
    tokensUsed: params.tokensUsed ?? 0,
    version: params.version ?? 1,
    artifacts: params.artifacts ?? [],
    parentTaskId: params.parentTaskId ?? null,
  }
}
