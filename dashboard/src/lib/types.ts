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
