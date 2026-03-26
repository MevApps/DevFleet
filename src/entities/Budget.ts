export interface TokenBudget {
  readonly maxTokens: number
  readonly maxCostUsd: number
  readonly remaining: number
}

export interface CreateBudgetParams {
  maxTokens: number
  maxCostUsd: number
}

export function createBudget(params: CreateBudgetParams): TokenBudget {
  return {
    maxTokens: params.maxTokens,
    maxCostUsd: params.maxCostUsd,
    remaining: params.maxTokens,
  }
}

export function consumeTokens(budget: TokenBudget, tokens: number): TokenBudget {
  return {
    ...budget,
    remaining: Math.max(0, budget.remaining - tokens),
  }
}

export function isExhausted(budget: TokenBudget): boolean {
  return budget.remaining <= 0
}
