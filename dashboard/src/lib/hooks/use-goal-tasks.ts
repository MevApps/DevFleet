// src/lib/hooks/use-goal-tasks.ts
import type { TaskDTO } from "@/lib/types"

export const DONE_STATUSES = new Set(["completed", "approved", "merged"])
export const ACTIVE_STATUSES = new Set(["in_progress", "busy"])
export const REVIEW_STATUSES = new Set(["review", "pending_review"])

export const SEGMENT_COLORS: Record<string, string> = {
  done: "var(--status-green-fg)",
  active: "var(--status-blue-fg)",
  review: "var(--status-purple-fg)",
  queued: "var(--border)",
}

export interface PhaseSegment {
  readonly type: "done" | "active" | "review" | "queued"
  readonly percent: number
}

export interface TaskProgress {
  readonly done: number
  readonly total: number
}

export function getGoalTasks(tasks: readonly TaskDTO[], goalId: string): TaskDTO[] {
  return tasks.filter((t) => t.goalId === goalId)
}

export function getTaskDisplayPhase(task: TaskDTO): string {
  if (DONE_STATUSES.has(task.status)) return "done"
  if (REVIEW_STATUSES.has(task.status)) return "review"
  return task.phase || "implementation"
}

export function computePhaseSegments(tasks: readonly TaskDTO[]): PhaseSegment[] {
  if (tasks.length === 0) return []

  let done = 0, active = 0, review = 0, queued = 0
  for (const t of tasks) {
    if (DONE_STATUSES.has(t.status)) done++
    else if (ACTIVE_STATUSES.has(t.status)) active++
    else if (REVIEW_STATUSES.has(t.status)) review++
    else queued++
  }

  const total = tasks.length
  const segments: PhaseSegment[] = []
  if (done > 0) segments.push({ type: "done", percent: Math.round((done / total) * 100) })
  if (active > 0) segments.push({ type: "active", percent: Math.round((active / total) * 100) })
  if (review > 0) segments.push({ type: "review", percent: Math.round((review / total) * 100) })
  if (queued > 0) segments.push({ type: "queued", percent: Math.round((queued / total) * 100) })
  return segments
}

export function computeTaskProgress(tasks: readonly TaskDTO[], goalTaskCount: number): TaskProgress {
  const done = tasks.filter((t) => DONE_STATUSES.has(t.status)).length
  return { done, total: Math.max(tasks.length, goalTaskCount) }
}
