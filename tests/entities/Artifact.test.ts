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
      metadata: { version: 1 },
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
      metadata: { linesAdded: 10, linesRemoved: 2 },
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
      metadata: { approved: true, comments: [] },
    })
    expect(artifact.kind).toBe("review")
    if (artifact.kind === "review") {
      expect(artifact.metadata.approved).toBe(true)
    }
  })

  test("all artifact kinds are accepted", () => {
    const kinds = ["spec", "plan", "design", "diff", "review", "test_report", "metric_report"] as const
    for (const kind of kinds) {
      const a = createArtifact({
        id: createArtifactId(),
        kind,
        format: "markdown",
        taskId: createTaskId(),
        createdBy: createAgentId("agent-x"),
        content: "content",
        metadata: {},
      })
      expect(a.kind).toBe(kind)
    }
  })
})
