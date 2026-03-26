import { createKeepDiscardRecord } from "../../src/entities/KeepDiscardRecord"
import { createAgentId, createTaskId, createArtifactId } from "../../src/entities/ids"

describe("KeepDiscardRecord", () => {
  const baseParams = {
    taskId: createTaskId("t-1"),
    agentId: createAgentId("dev-1"),
    phase: "code",
    durationMs: 5000,
    tokensUsed: 1200,
    verdict: "approved" as const,
    reasons: ["all tests pass", "no lint errors"],
    artifactIds: [createArtifactId("a-1")],
    commitHash: "abc123",
  }

  it("creates record with default recordedAt", () => {
    const before = new Date()
    const record = createKeepDiscardRecord(baseParams)
    const after = new Date()
    expect(record.recordedAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(record.recordedAt.getTime()).toBeLessThanOrEqual(after.getTime())
  })

  it("creates record with explicit recordedAt", () => {
    const date = new Date("2026-02-01")
    const record = createKeepDiscardRecord({ ...baseParams, recordedAt: date })
    expect(record.recordedAt).toBe(date)
  })

  it("preserves all fields", () => {
    const record = createKeepDiscardRecord(baseParams)
    expect(record.taskId).toBe(baseParams.taskId)
    expect(record.agentId).toBe(baseParams.agentId)
    expect(record.phase).toBe("code")
    expect(record.durationMs).toBe(5000)
    expect(record.tokensUsed).toBe(1200)
    expect(record.verdict).toBe("approved")
    expect(record.reasons).toEqual(["all tests pass", "no lint errors"])
    expect(record.artifactIds).toHaveLength(1)
    expect(record.commitHash).toBe("abc123")
  })

  it("supports null commitHash", () => {
    const record = createKeepDiscardRecord({ ...baseParams, commitHash: null })
    expect(record.commitHash).toBeNull()
  })

  it("supports rejected verdict", () => {
    const record = createKeepDiscardRecord({ ...baseParams, verdict: "rejected", reasons: ["tests failed"] })
    expect(record.verdict).toBe("rejected")
  })
})
