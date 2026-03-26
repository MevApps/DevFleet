import {
  createTaskId, createGoalId, createAgentId, createArtifactId,
  createMessageId, createEventId, createProjectId,
  type TaskId, type GoalId, type AgentId,
} from "../../src/entities/ids"

describe("Identity types", () => {
  test("createTaskId produces a branded string", () => {
    const id = createTaskId()
    expect(typeof id).toBe("string")
    expect(id.length).toBeGreaterThan(0)
  })
  test("createTaskId with custom value preserves value", () => {
    const id = createTaskId("task-123")
    expect(id).toBe("task-123")
  })
  test("each factory produces unique IDs", () => {
    const ids = Array.from({ length: 100 }, () => createTaskId())
    const unique = new Set(ids)
    expect(unique.size).toBe(100)
  })
  test("createGoalId produces a branded string", () => {
    const id = createGoalId()
    expect(typeof id).toBe("string")
    expect(id.length).toBeGreaterThan(0)
  })
  test("createAgentId produces a branded string", () => {
    const id = createAgentId("developer-opus-1")
    expect(id).toBe("developer-opus-1")
  })
  test("all ID factories produce strings", () => {
    expect(typeof createArtifactId()).toBe("string")
    expect(typeof createMessageId()).toBe("string")
    expect(typeof createEventId()).toBe("string")
    expect(typeof createProjectId()).toBe("string")
  })
})
