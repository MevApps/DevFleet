import type { Goal } from "../../entities/Goal"
import type { GoalId } from "../../entities/ids"

export interface GoalRepository {
  findById(id: GoalId): Promise<Goal | null>
  create(goal: Goal): Promise<void>
  update(goal: Goal): Promise<void>
}
