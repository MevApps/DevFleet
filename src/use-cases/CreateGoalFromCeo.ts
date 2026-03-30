import type { GoalRepository } from "./ports/GoalRepository"
import type { MessagePort } from "./ports/MessagePort"
import type { Goal } from "../entities/Goal"
import { createGoal } from "../entities/Goal"
import { createGoalId, createMessageId } from "../entities/ids"
import { createBudget } from "../entities/Budget"
import { success, failure, type Result } from "./Result"

export interface CreateGoalInput {
  readonly description: string
  readonly maxTokens: number
  readonly maxCostUsd: number
  readonly phases?: readonly string[]
}

export class CreateGoalFromCeo {
  constructor(
    private readonly goals: GoalRepository,
    private readonly bus: MessagePort,
  ) {}

  async execute(input: CreateGoalInput): Promise<Result<Goal>> {
    const description = input.description.trim()
    if (!description) return failure("Goal description must not be empty")
    if (input.maxTokens <= 0 || input.maxCostUsd <= 0) return failure("Budget must be greater than zero")

    const goal = createGoal({
      id: createGoalId(),
      description,
      totalBudget: createBudget({ maxTokens: input.maxTokens, maxCostUsd: input.maxCostUsd }),
      status: "active",
    })

    await this.goals.create(goal)
    console.log("[CreateGoalFromCeo] goal created in repo:", goal.id)
    console.log("[CreateGoalFromCeo] emitting goal.created on bus...")
    await this.bus.emit({
      id: createMessageId(),
      type: "goal.created",
      goalId: goal.id,
      description: goal.description,
      phases: input.phases,
      timestamp: new Date(),
    })
    console.log("[CreateGoalFromCeo] bus.emit returned")

    return success(goal)
  }
}
