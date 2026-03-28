import type { WorkspaceRunId } from "./ids"
import type { ProjectConfig } from "./ProjectConfig"

export type WorkspaceRunStatus =
  | "created"
  | "cloning"
  | "installing"
  | "detecting"
  | "active"
  | "stopped"
  | "stopped_dirty"
  | "failed"

export interface WorkspaceRunConfig {
  readonly repoUrl: string
  readonly maxCostUsd: number
  readonly maxTokens: number
  readonly supervisorModel: string
  readonly developerModel: string
  readonly reviewerModel: string
  readonly timeoutMs: number
}

export const DEFAULT_WORKSPACE_CONFIG: Omit<WorkspaceRunConfig, "repoUrl"> = {
  maxCostUsd: 10.0,
  maxTokens: 200_000,
  supervisorModel: "claude-opus-4-20250514",
  developerModel: "claude-sonnet-4-20250514",
  reviewerModel: "claude-opus-4-20250514",
  timeoutMs: 600_000,
}

export interface WorkspaceRun {
  readonly id: WorkspaceRunId
  readonly config: WorkspaceRunConfig
  readonly status: WorkspaceRunStatus
  readonly projectConfig: ProjectConfig | null
  readonly startedAt: Date
  readonly completedAt: Date | null
  readonly error: string | null
}

export function createWorkspaceRun(params: {
  id: WorkspaceRunId
  config: WorkspaceRunConfig
  status?: WorkspaceRunStatus
  projectConfig?: ProjectConfig | null
  startedAt?: Date
  completedAt?: Date | null
  error?: string | null
}): WorkspaceRun {
  return Object.freeze({
    id: params.id,
    config: Object.freeze({ ...params.config }),
    status: params.status ?? "created",
    projectConfig: params.projectConfig ?? null,
    startedAt: params.startedAt ?? new Date(),
    completedAt: params.completedAt ?? null,
    error: params.error ?? null,
  })
}
