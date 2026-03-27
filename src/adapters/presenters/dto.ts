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
  readonly activeTasks: TaskDTO[]
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
