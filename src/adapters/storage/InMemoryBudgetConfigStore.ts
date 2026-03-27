import type { BudgetConfigStore, BudgetDefaults } from "../../use-cases/ports/BudgetConfigStore"

export class InMemoryBudgetConfigStore implements BudgetConfigStore {
  private readonly store = new Map<string, BudgetDefaults>()

  constructor(defaults?: ReadonlyArray<BudgetDefaults>) {
    for (const d of defaults ?? []) { this.store.set(d.role, d) }
  }

  async read(role: string): Promise<BudgetDefaults> {
    return this.store.get(role) ?? { role, maxTokens: 10000, maxCostUsd: 1.0 }
  }

  async update(role: string, maxTokens: number, maxCostUsd: number): Promise<void> {
    this.store.set(role, { role, maxTokens, maxCostUsd })
  }
}
