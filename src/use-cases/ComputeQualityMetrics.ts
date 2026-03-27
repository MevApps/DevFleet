import type { KeepDiscardRepository } from "./ports/KeepDiscardRepository"
import type { MetricsFilter } from "../entities/MetricsFilter"
import type { QualityReport } from "../entities/Reports"

export class ComputeQualityMetrics {
  constructor(private readonly keepDiscardRepo: KeepDiscardRepository) {}

  async execute(filter?: MetricsFilter): Promise<QualityReport> {
    let records = await this.keepDiscardRepo.findAll()
    if (filter?.agentId) records = records.filter(r => r.agentId === filter.agentId)
    if (filter?.goalId) records = records.filter(r => r.goalId === filter.goalId)
    if (filter?.since) records = records.filter(r => r.recordedAt >= filter.since!)
    if (filter?.until) records = records.filter(r => r.recordedAt <= filter.until!)

    const total = records.length
    const approved = records.filter(r => r.verdict === "approved").length
    const overallKeepRate = total > 0 ? approved / total : 0

    const byAgent = new Map<string, { approved: number; total: number }>()
    for (const r of records) {
      const key = r.agentId as string
      const entry = byAgent.get(key) ?? { approved: 0, total: 0 }
      entry.total++
      if (r.verdict === "approved") entry.approved++
      byAgent.set(key, entry)
    }
    const keepRateByAgent: Record<string, number> = {}
    for (const [agent, counts] of byAgent) {
      keepRateByAgent[agent] = counts.total > 0 ? counts.approved / counts.total : 0
    }

    const firstAttempts = records.filter(r => r.iteration === 1)
    const firstApproved = firstAttempts.filter(r => r.verdict === "approved").length
    const reviewPassRate = firstAttempts.length > 0 ? firstApproved / firstAttempts.length : 0

    const reasonCounts = new Map<string, number>()
    for (const r of records) {
      for (const reason of r.reasons) {
        reasonCounts.set(reason, (reasonCounts.get(reason) ?? 0) + 1)
      }
    }
    const topRejectionReasons = [...reasonCounts.entries()]
      .map(([reason, count]) => ({ reason, count }))
      .sort((a, b) => b.count - a.count)

    return { overallKeepRate, keepRateByAgent, reviewPassRate, topRejectionReasons, recentRecords: [...records].slice(-20) }
  }
}
