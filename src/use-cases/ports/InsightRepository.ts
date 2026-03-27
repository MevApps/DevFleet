import type { Insight, InsightStatus } from "../../entities/Insight"
import type { InsightId } from "../../entities/ids"

export interface InsightRepository {
  save(insight: Insight): Promise<void>
  findById(id: InsightId): Promise<Insight | null>
  findByStatus(status: InsightStatus): Promise<ReadonlyArray<Insight>>
  findAll(): Promise<ReadonlyArray<Insight>>
  update(insight: Insight): Promise<void>
}
