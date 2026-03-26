import type { Goal } from "../../entities/Goal"
import type { GoalId } from "../../entities/ids"
import type { GoalRepository } from "../../use-cases/ports/GoalRepository"

export class InMemoryGoalRepo implements GoalRepository {
  private readonly store = new Map<string, Goal>()

  async findById(id: GoalId): Promise<Goal | null> {
    return this.store.get(id) ?? null
  }

  async create(goal: Goal): Promise<void> {
    this.store.set(goal.id, goal)
  }

  async update(goal: Goal): Promise<void> {
    if (!this.store.has(goal.id)) {
      throw new Error(`Goal ${goal.id} not found`)
    }
    this.store.set(goal.id, goal)
  }
}
