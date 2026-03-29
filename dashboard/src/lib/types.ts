// CONTRACT: Mirror of src/adapters/presenters/dto.ts
export interface AgentDTO { readonly id: string; readonly role: string; readonly status: string; readonly currentTaskId: string | null; readonly model: string; readonly lastActiveAt: string }
export interface TaskDTO { readonly id: string; readonly goalId: string; readonly description: string; readonly status: string; readonly phase: string; readonly assignedTo: string | null; readonly tokensUsed: number; readonly budget: BudgetDTO; readonly retryCount: number; readonly branch: string | null }
export interface BudgetDTO { readonly maxTokens: number; readonly maxCostUsd: number; readonly remaining: number }
export interface GoalDTO { readonly id: string; readonly description: string; readonly status: string; readonly createdAt: string; readonly completedAt: string | null; readonly taskCount: number; readonly totalBudget: BudgetDTO }
export interface EventDTO { readonly id: string; readonly type: string; readonly agentId: string | null; readonly taskId: string | null; readonly goalId: string | null; readonly occurredAt: string }
export interface LiveFloorData { readonly agents: readonly AgentDTO[]; readonly activeTasks: readonly TaskDTO[]; readonly recentEvents: readonly EventDTO[] }
export interface PipelineData { readonly phases: readonly string[]; readonly tasksByPhase: Record<string, readonly TaskDTO[]>; readonly goals: readonly GoalDTO[] }
export interface MetricsSummary { readonly totalTokensUsed: number; readonly totalCostUsd: number; readonly activeTaskCount: number; readonly completedTaskCount: number; readonly agentTokenBreakdown: Record<string, number> }
export interface SSEEvent { readonly id: string; readonly type: string; readonly timestamp: string; readonly goalId?: string; readonly taskId?: string; readonly agentId?: string; readonly description?: string; readonly reason?: string; readonly branch?: string }

// Phase 4 types
export interface FinancialsData { readonly totalTokensUsed: number; readonly totalCostUsd: number; readonly costPerGoal: ReadonlyArray<{ goalId: string; costUsd: number }>; readonly agentTokenBreakdown: Record<string, number>; readonly modelTierBreakdown: Record<string, number> }
export interface QualityData { readonly overallKeepRate: number; readonly keepRateByAgent: Record<string, number>; readonly reviewPassRate: number; readonly topRejectionReasons: ReadonlyArray<{ reason: string; count: number }> }
export interface TimingsData { readonly avgDurationByPhase: Record<string, number>; readonly stalledPhases: ReadonlyArray<{ phase: string; avgMs: number; threshold: number }>; readonly agentEfficiency: Record<string, number> }
export interface InsightSummary { readonly id: string; readonly title: string; readonly actionKind: string; readonly status: string; readonly createdAt: string }
export interface InsightDetail { readonly id: string; readonly title: string; readonly description: string; readonly evidence: string; readonly proposedAction: unknown; readonly status: string; readonly createdAt: string; readonly resolvedAt: string | null }
export interface CeoAlertData { readonly severity: "info" | "warning" | "urgent"; readonly title: string; readonly body: string; readonly goalId: string | null; readonly taskId: string | null; readonly insightId: string | null; readonly timestamp: string }
export interface AlertPreferencesData { readonly minSeverity: "info" | "warning" | "urgent"; readonly mutedTriggers: string[] }
export interface PluginHealth { readonly name: string; readonly status: "healthy" | "degraded" | "unhealthy" }

// Workspace types
export type WorkspaceRunStatus =
  | "created"
  | "cloning"
  | "installing"
  | "detecting"
  | "active"
  | "stopped"
  | "stopped_dirty"
  | "failed"

export interface WorkspaceStartInput {
  readonly repoUrl: string
  readonly maxCostUsd?: number
  readonly maxTokens?: number
  readonly supervisorModel?: string
  readonly developerModel?: string
  readonly reviewerModel?: string
  readonly timeoutMs?: number
}

export interface WorkspaceRunDTO {
  readonly id: string
  readonly config: WorkspaceStartInput
  readonly status: WorkspaceRunStatus
  readonly projectConfig: {
    readonly language: string
    readonly testCommand: string
    readonly installCommand: string
  } | null
  readonly startedAt: string
  readonly completedAt: string | null
  readonly error: string | null
}

export interface WorkspaceGoalSummaryDTO {
  readonly goalId: string
  readonly description: string
  readonly status: string
  readonly costUsd: number
  readonly durationMs: number
  readonly prUrl: string | null
}

export interface WorkspaceStatusDTO {
  readonly run: WorkspaceRunDTO
  readonly costUsd: number
  readonly goalSummaries: readonly WorkspaceGoalSummaryDTO[]
}

// Diff types (Phase 3)
export interface DiffLineDTO { readonly type: "addition" | "deletion" | "context"; readonly content: string }
export interface DiffHunkDTO { readonly lines: readonly DiffLineDTO[] }
export interface DiffFileDTO { readonly path: string; readonly additions: number; readonly deletions: number; readonly hunks: readonly DiffHunkDTO[] }
export interface TaskDiffDTO { readonly taskId: string; readonly files: readonly DiffFileDTO[] }
