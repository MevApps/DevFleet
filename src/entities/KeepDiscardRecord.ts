import { type TaskId, type GoalId, type AgentId, type ArtifactId } from "./ids"

export interface KeepDiscardRecord {
  readonly taskId: TaskId
  readonly goalId: GoalId
  readonly agentId: AgentId
  readonly phase: string
  readonly durationMs: number
  readonly tokensUsed: number
  readonly costUsd: number
  readonly verdict: "approved" | "rejected"
  readonly reasons: readonly string[]
  readonly artifactIds: readonly ArtifactId[]
  readonly commitHash: string | null
  readonly iteration: number
  readonly recordedAt: Date
}

export interface CreateKeepDiscardRecordParams {
  taskId: TaskId
  goalId: GoalId
  agentId: AgentId
  phase: string
  durationMs: number
  tokensUsed: number
  costUsd: number
  verdict: "approved" | "rejected"
  reasons: readonly string[]
  artifactIds: readonly ArtifactId[]
  commitHash: string | null
  iteration: number
  recordedAt?: Date
}

export function createKeepDiscardRecord(params: CreateKeepDiscardRecordParams): KeepDiscardRecord {
  return { ...params, recordedAt: params.recordedAt ?? new Date() }
}
