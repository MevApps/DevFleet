import type { InsightId } from "./ids"

export type ProposedAction =
  | { readonly kind: "prompt_update"; readonly role: string; readonly currentContent: string; readonly newContent: string }
  | { readonly kind: "budget_tune"; readonly role: string; readonly currentMaxTokens: number; readonly currentMaxCostUsd: number; readonly newMaxTokens: number; readonly newMaxCostUsd: number }
  | { readonly kind: "model_reassign"; readonly role: string; readonly currentModel: string; readonly newModel: string }
  | { readonly kind: "skill_update"; readonly skillName: string; readonly currentContent: string; readonly newContent: string }
  | { readonly kind: "process_change"; readonly description: string }

export type InsightStatus = "pending" | "applied" | "dismissed"

export interface Insight {
  readonly id: InsightId
  readonly title: string
  readonly description: string
  readonly evidence: string
  readonly proposedAction: ProposedAction
  readonly status: InsightStatus
  readonly outcomeMetric: number | null
  readonly createdAt: Date
  readonly resolvedAt: Date | null
}

export interface CreateInsightParams {
  readonly id: InsightId
  readonly title: string
  readonly description: string
  readonly evidence: string
  readonly proposedAction: ProposedAction
}

export function createInsight(params: CreateInsightParams): Insight {
  return {
    ...params,
    status: "pending",
    outcomeMetric: null,
    createdAt: new Date(),
    resolvedAt: null,
  }
}
