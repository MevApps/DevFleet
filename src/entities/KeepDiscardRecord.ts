import { type TaskId, type AgentId, type ArtifactId } from "./ids"

export interface KeepDiscardRecord {
  readonly taskId: TaskId
  readonly agentId: AgentId
  readonly phase: string
  readonly durationMs: number
  readonly tokensUsed: number
  readonly verdict: "approved" | "rejected"
  readonly reasons: readonly string[]
  readonly artifactIds: readonly ArtifactId[]
  readonly commitHash: string | null
  readonly recordedAt: Date
}

export interface CreateKeepDiscardRecordParams {
  taskId: TaskId
  agentId: AgentId
  phase: string
  durationMs: number
  tokensUsed: number
  verdict: "approved" | "rejected"
  reasons: readonly string[]
  artifactIds: readonly ArtifactId[]
  commitHash: string | null
  recordedAt?: Date
}

export function createKeepDiscardRecord(params: CreateKeepDiscardRecordParams): KeepDiscardRecord {
  return { ...params, recordedAt: params.recordedAt ?? new Date() }
}
