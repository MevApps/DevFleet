import type { GoalId } from "./ids"
import type { KeepDiscardRecord } from "./KeepDiscardRecord"

export interface FinancialsReport {
  readonly totalTokensUsed: number
  readonly totalCostUsd: number
  readonly costPerGoal: ReadonlyArray<{ goalId: GoalId; costUsd: number }>
  readonly agentTokenBreakdown: Record<string, number>
  readonly modelTierBreakdown: Record<string, number>
}

export interface QualityReport {
  readonly overallKeepRate: number
  readonly keepRateByAgent: Record<string, number>
  readonly reviewPassRate: number
  readonly topRejectionReasons: ReadonlyArray<{ reason: string; count: number }>
  readonly recentRecords: ReadonlyArray<KeepDiscardRecord>
}

export interface TimingsReport {
  readonly avgDurationByPhase: Record<string, number>
  readonly stalledPhases: ReadonlyArray<{ phase: string; avgMs: number; threshold: number }>
  readonly agentEfficiency: Record<string, number>
}
