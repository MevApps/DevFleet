import { createArtifact, type Artifact } from "../../src/entities/Artifact"
import {
  createArtifactId,
  createTaskId,
  createAgentId,
} from "../../src/entities/ids"

describe("Artifact discriminated union", () => {
  test("createArtifact creates a spec artifact", () => {
    const artifact = createArtifact({
      id: createArtifactId("a-1"),
      kind: "spec",
      format: "markdown",
      taskId: createTaskId("t-1"),
      createdBy: createAgentId("agent-1"),
      content: "# Spec\n\nSome spec content",
      metadata: { requirementCount: 3, hasSuccessCriteria: true },
    })
    expect(artifact.kind).toBe("spec")
    expect(artifact.content).toBe("# Spec\n\nSome spec content")
  })

  test("createArtifact creates a diff artifact", () => {
    const artifact = createArtifact({
      id: createArtifactId("a-2"),
      kind: "diff",
      format: "patch",
      taskId: createTaskId("t-1"),
      createdBy: createAgentId("agent-1"),
      content: "diff --git a/foo.ts ...",
      metadata: { filesChanged: 1, linesAdded: 10, linesRemoved: 2 },
    })
    expect(artifact.kind).toBe("diff")
    if (artifact.kind === "diff") {
      expect(artifact.metadata.linesAdded).toBe(10)
    }
  })

  test("createArtifact creates a review artifact", () => {
    const artifact = createArtifact({
      id: createArtifactId("a-3"),
      kind: "review",
      format: "markdown",
      taskId: createTaskId("t-1"),
      createdBy: createAgentId("reviewer-1"),
      content: "LGTM",
      metadata: { verdict: "approved", issueCount: 0 },
    })
    expect(artifact.kind).toBe("review")
    if (artifact.kind === "review") {
      expect(artifact.metadata.verdict).toBe("approved")
    }
  })

  test("all artifact kinds are accepted", () => {
    const kinds = ["spec", "plan", "design", "diff", "review", "test_report", "metric_report"] as const
    const metadataByKind: Record<string, object> = {
      spec: { requirementCount: 1, hasSuccessCriteria: false },
      plan: { stepCount: 2, estimatedTokens: 1000 },
      design: { componentCount: 3 },
      diff: { filesChanged: 1, linesAdded: 5, linesRemoved: 2 },
      review: { verdict: "approved", issueCount: 0 },
      test_report: { passed: 10, failed: 0, coverageDelta: 0.05 },
      metric_report: { metricCount: 4, periodStart: 0, periodEnd: 100 },
    }
    for (const kind of kinds) {
      const a = createArtifact({
        id: createArtifactId(),
        kind,
        format: "markdown",
        taskId: createTaskId(),
        createdBy: createAgentId("agent-x"),
        content: "content",
        metadata: metadataByKind[kind] as never,
      })
      expect(a.kind).toBe(kind)
    }
  })
})

describe("tightened metadata", () => {
  it("spec metadata requires requirementCount and hasSuccessCriteria", () => {
    const artifact = createArtifact({ id: createArtifactId(), kind: "spec", format: "markdown", taskId: createTaskId(), createdBy: createAgentId("prod-1"), content: "# Spec", metadata: { requirementCount: 5, hasSuccessCriteria: true } })
    expect(artifact.metadata.requirementCount).toBe(5)
    expect(artifact.metadata.hasSuccessCriteria).toBe(true)
  })
  it("plan metadata requires stepCount and estimatedTokens", () => {
    const artifact = createArtifact({ id: createArtifactId(), kind: "plan", format: "markdown", taskId: createTaskId(), createdBy: createAgentId("arch-1"), content: "# Plan", metadata: { stepCount: 3, estimatedTokens: 5000 } })
    expect(artifact.metadata.stepCount).toBe(3)
  })
  it("review metadata requires verdict and issueCount", () => {
    const artifact = createArtifact({ id: createArtifactId(), kind: "review", format: "markdown", taskId: createTaskId(), createdBy: createAgentId("rev-1"), content: "LGTM", metadata: { verdict: "approved", issueCount: 0 } })
    expect(artifact.metadata.verdict).toBe("approved")
  })
  it("diff metadata requires filesChanged, linesAdded, linesRemoved", () => {
    const artifact = createArtifact({ id: createArtifactId(), kind: "diff", format: "diff", taskId: createTaskId(), createdBy: createAgentId("dev-1"), content: "--- a\n+++ b", metadata: { filesChanged: 2, linesAdded: 10, linesRemoved: 3 } })
    expect(artifact.metadata.filesChanged).toBe(2)
  })
})
