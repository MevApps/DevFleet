import { ComputeQualityMetrics } from "@use-cases/ComputeQualityMetrics"
import { InMemoryKeepDiscardRepository } from "@adapters/storage/InMemoryKeepDiscardRepository"
import { createKeepDiscardRecord } from "@entities/KeepDiscardRecord"
import { createTaskId, createGoalId, createAgentId } from "@entities/ids"

function makeRecord(verdict: "approved" | "rejected", agentId: string, reasons: string[] = []) {
  return createKeepDiscardRecord({
    taskId: createTaskId(), goalId: createGoalId(), agentId: createAgentId(agentId),
    phase: "review", durationMs: 1000, tokensUsed: 500, costUsd: 0.05,
    verdict, reasons, artifactIds: [], commitHash: null, iteration: 1,
  })
}

describe("ComputeQualityMetrics", () => {
  it("computes overall keep rate", async () => {
    const repo = new InMemoryKeepDiscardRepository()
    await repo.save(makeRecord("approved", "dev-1"))
    await repo.save(makeRecord("approved", "dev-1"))
    await repo.save(makeRecord("rejected", "dev-1", ["no tests"]))
    const uc = new ComputeQualityMetrics(repo)
    const report = await uc.execute()
    expect(report.overallKeepRate).toBeCloseTo(2 / 3)
  })

  it("computes keep rate by agent", async () => {
    const repo = new InMemoryKeepDiscardRepository()
    await repo.save(makeRecord("approved", "dev-1"))
    await repo.save(makeRecord("rejected", "dev-1"))
    await repo.save(makeRecord("approved", "dev-2"))
    const uc = new ComputeQualityMetrics(repo)
    const report = await uc.execute()
    expect(report.keepRateByAgent["dev-1"]).toBeCloseTo(0.5)
    expect(report.keepRateByAgent["dev-2"]).toBeCloseTo(1.0)
  })

  it("ranks top rejection reasons", async () => {
    const repo = new InMemoryKeepDiscardRepository()
    await repo.save(makeRecord("rejected", "dev-1", ["no tests", "bad naming"]))
    await repo.save(makeRecord("rejected", "dev-1", ["no tests"]))
    const uc = new ComputeQualityMetrics(repo)
    const report = await uc.execute()
    expect(report.topRejectionReasons[0]).toEqual({ reason: "no tests", count: 2 })
    expect(report.topRejectionReasons[1]).toEqual({ reason: "bad naming", count: 1 })
  })

  it("includes recent records for AI context", async () => {
    const repo = new InMemoryKeepDiscardRepository()
    await repo.save(makeRecord("approved", "dev-1"))
    const uc = new ComputeQualityMetrics(repo)
    const report = await uc.execute()
    expect(report.recentRecords).toHaveLength(1)
  })
})
