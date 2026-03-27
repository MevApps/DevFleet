import type { Goal } from "../../entities/Goal"
import type { GoalId } from "../../entities/ids"

export interface GoalRepository {
  findById(id: GoalId): Promise<Goal | null>
  findAll(): Promise<ReadonlyArray<Goal>>
  create(goal: Goal): Promise<void>
  update(goal: Goal): Promise<void>
}
