import { type ProjectId } from "./ids"
import { type TokenBudget } from "./Budget"

export interface TechStack {
  readonly language: string
  readonly framework: string | null
  readonly testRunner: string | null
  readonly buildTool: string | null
  readonly packageManager: string
}

export interface QualityGate {
  readonly minTestCoverage: number
  readonly requiresPassingBuild: boolean
  readonly requiresPassingTests: boolean
  readonly requiresReview: boolean
}

export interface BudgetDefaults {
  readonly taskMaxTokens: number
  readonly taskMaxCostUsd: number
  readonly goalMaxTokens: number
  readonly goalMaxCostUsd: number
}

export interface ProjectConfig {
  readonly techStack: TechStack
  readonly qualityGate: QualityGate
  readonly budgetDefaults: BudgetDefaults
  readonly phases: readonly string[]
}

export interface Project {
  readonly id: ProjectId
  readonly name: string
  readonly description: string
  readonly config: ProjectConfig
  readonly totalBudget: TokenBudget
  readonly createdAt: Date
  readonly updatedAt: Date
}
