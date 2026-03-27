import type { Insight, InsightStatus } from "../../entities/Insight"
import type { InsightId } from "../../entities/ids"
import type { InsightRepository } from "../../use-cases/ports/InsightRepository"

export class InMemoryInsightRepository implements InsightRepository {
  private readonly store = new Map<string, Insight>()

  async save(insight: Insight): Promise<void> { this.store.set(insight.id, insight) }
  async findById(id: InsightId): Promise<Insight | null> { return this.store.get(id) ?? null }
  async findByStatus(status: InsightStatus): Promise<ReadonlyArray<Insight>> { return [...this.store.values()].filter(i => i.status === status) }
  async findAll(): Promise<ReadonlyArray<Insight>> { return [...this.store.values()] }
  async update(insight: Insight): Promise<void> {
    if (!this.store.has(insight.id)) throw new Error(`Insight ${insight.id} not found`)
    this.store.set(insight.id, insight)
  }
}
