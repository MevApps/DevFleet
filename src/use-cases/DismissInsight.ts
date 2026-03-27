// src/use-cases/DismissInsight.ts
import type { InsightRepository } from "./ports/InsightRepository"
import type { InsightId } from "../entities/ids"

export class DismissInsight {
  constructor(private readonly insightRepo: InsightRepository) {}

  async execute(insightId: InsightId): Promise<void> {
    const insight = await this.insightRepo.findById(insightId)
    if (!insight) throw new Error(`Insight ${insightId} not found`)
    if (insight.status !== "pending") throw new Error(`Insight ${insightId} is ${insight.status}, not pending`)
    await this.insightRepo.update({ ...insight, status: "dismissed", resolvedAt: new Date() })
  }
}
