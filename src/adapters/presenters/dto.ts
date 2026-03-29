export interface BudgetDTO {
  readonly maxTokens: number
  readonly maxCostUsd: number
  readonly remaining: number
}

export interface AgentDTO {
  readonly id: string
  readonly role: string
  readonly status: string
  readonly currentTaskId: string | null
  readonly model: string
  readonly lastActiveAt: string
}

export interface TaskDTO {
  readonly id: string
  readonly goalId: string
  readonly description: string
  readonly status: string
  readonly phase: string
  readonly assignedTo: string | null
  readonly tokensUsed: number
  readonly budget: BudgetDTO
  readonly retryCount: number
  readonly branch: string | null
}

export interface GoalDTO {
  readonly id: string
  readonly description: string
  readonly status: string
  readonly createdAt: string
  readonly completedAt: string | null
  readonly taskCount: number
  readonly totalBudget: BudgetDTO
}

export interface EventCostDTO {
  readonly inputTokens: number
  readonly outputTokens: number
  readonly totalTokens: number
  readonly estimatedCostUsd: number
}

export interface EventDTO {
  readonly id: string
  readonly type: string
  readonly agentId: string | null
  readonly taskId: string | null
  readonly goalId: string | null
  readonly cost: EventCostDTO | null
  readonly occurredAt: string
}

export interface LiveFloorDTO {
  readonly agents: AgentDTO[]
  readonly allTasks: TaskDTO[]
  readonly recentEvents: EventDTO[]
}

export interface PipelineDTO {
  readonly phases: string[]
  readonly tasksByPhase: Record<string, TaskDTO[]>
  readonly goals: GoalDTO[]
}

export interface MetricsSummaryDTO {
  readonly totalTokensUsed: number
  readonly totalCostUsd: number
  readonly activeTaskCount: number
  readonly completedTaskCount: number
  readonly agentTokenBreakdown: Record<string, number>
}

// ---------------------------------------------------------------------------
// Phase 4 DTOs
// ---------------------------------------------------------------------------
import type { ProposedAction } from "../../entities/Insight"

export interface FinancialsDTO {
  readonly totalTokensUsed: number
  readonly totalCostUsd: number
  readonly costPerGoal: ReadonlyArray<{ goalId: string; costUsd: number }>
  readonly agentTokenBreakdown: Record<string, number>
  readonly modelTierBreakdown: Record<string, number>
}

export interface QualityDTO {
  readonly overallKeepRate: number
  readonly keepRateByAgent: Record<string, number>
  readonly reviewPassRate: number
  readonly topRejectionReasons: ReadonlyArray<{ reason: string; count: number }>
}

export interface TimingsDTO {
  readonly avgDurationByPhase: Record<string, number>
  readonly stalledPhases: ReadonlyArray<{ phase: string; avgMs: number; threshold: number }>
  readonly agentEfficiency: Record<string, number>
}

export interface InsightSummaryDTO {
  readonly id: string
  readonly title: string
  readonly actionKind: string
  readonly status: string
  readonly createdAt: string
}

export interface InsightDetailDTO {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly evidence: string
  readonly proposedAction: ProposedAction
  readonly status: string
  readonly createdAt: string
  readonly resolvedAt: string | null
}

export interface CeoAlertDTO {
  readonly severity: "info" | "warning" | "urgent"
  readonly title: string
  readonly body: string
  readonly goalId: string | null
  readonly taskId: string | null
  readonly insightId: string | null
  readonly timestamp: string
}

export interface AlertPreferencesDTO {
  readonly minSeverity: "info" | "warning" | "urgent"
  readonly mutedTriggers: ReadonlyArray<string>
}

export interface PluginHealthDTO {
  readonly name: string
  readonly status: "healthy" | "degraded" | "unhealthy"
}
