export interface BudgetDefaults {
  readonly role: string
  readonly maxTokens: number
  readonly maxCostUsd: number
}

export interface BudgetConfigStore {
  read(role: string): Promise<BudgetDefaults>
  update(role: string, maxTokens: number, maxCostUsd: number): Promise<void>
}
