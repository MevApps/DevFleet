import {
  matchesFilter,
  type Message,
  type MessageFilter,
} from "../../src/entities/Message"
import { createMessageId, createGoalId, createTaskId, createAgentId, createArtifactId } from "../../src/entities/ids"

const goalCreated: Message = {
  type: "goal.created",
  id: createMessageId(),
  timestamp: new Date(),
  goalId: createGoalId("g-1"),
  description: "Build login feature",
}

const taskAssigned: Message = {
  type: "task.assigned",
  id: createMessageId(),
  timestamp: new Date(),
  taskId: createTaskId("t-1"),
  agentId: createAgentId("dev-1"),
}

describe("Message discriminated union", () => {
  test("goal.created message has correct type", () => {
    expect(goalCreated.type).toBe("goal.created")
    if (goalCreated.type === "goal.created") {
      expect(goalCreated.goalId).toBe("g-1")
    }
  })

  test("task.assigned message has correct shape", () => {
    expect(taskAssigned.type).toBe("task.assigned")
    if (taskAssigned.type === "task.assigned") {
      expect(taskAssigned.agentId).toBe("dev-1")
    }
  })

  test("matchesFilter: type match", () => {
    const filter: MessageFilter = { types: ["goal.created"] }
    expect(matchesFilter(goalCreated, filter)).toBe(true)
    expect(matchesFilter(taskAssigned, filter)).toBe(false)
  })

  test("matchesFilter: empty filter matches all", () => {
    const filter: MessageFilter = {}
    expect(matchesFilter(goalCreated, filter)).toBe(true)
    expect(matchesFilter(taskAssigned, filter)).toBe(true)
  })

  test("matchesFilter: multiple types", () => {
    const filter: MessageFilter = { types: ["goal.created", "task.assigned"] }
    expect(matchesFilter(goalCreated, filter)).toBe(true)
    expect(matchesFilter(taskAssigned, filter)).toBe(true)
  })
})

describe("matchesFilter – multi-field filtering", () => {
  const base = { id: createMessageId(), timestamp: new Date() }

  it("filters by agentId when message has agentId", () => {
    const msg = { ...base, type: "task.assigned" as const, taskId: createTaskId(), agentId: createAgentId("agent-1") }
    expect(matchesFilter(msg, { agentId: createAgentId("agent-1") })).toBe(true)
    expect(matchesFilter(msg, { agentId: createAgentId("agent-2") })).toBe(false)
  })

  it("filters by taskId when message has taskId", () => {
    const tid = createTaskId("task-x")
    const msg = { ...base, type: "task.completed" as const, taskId: tid, agentId: createAgentId("dev-1") }
    expect(matchesFilter(msg, { taskId: tid })).toBe(true)
    expect(matchesFilter(msg, { taskId: createTaskId("other") })).toBe(false)
  })

  it("filters by goalId when message has goalId", () => {
    const gid = createGoalId("goal-x")
    const msg = { ...base, type: "goal.created" as const, goalId: gid, description: "test" }
    expect(matchesFilter(msg, { goalId: gid })).toBe(true)
    expect(matchesFilter(msg, { goalId: createGoalId("other") })).toBe(false)
  })

  it("passes when message lacks the filtered field", () => {
    const msg = { ...base, type: "schedule.ideation" as const }
    expect(matchesFilter(msg, { agentId: createAgentId("agent-1") })).toBe(true)
  })

  it("combines type + agentId filters", () => {
    const msg = { ...base, type: "task.assigned" as const, taskId: createTaskId(), agentId: createAgentId("agent-1") }
    expect(matchesFilter(msg, { types: ["task.assigned"], agentId: createAgentId("agent-1") })).toBe(true)
    expect(matchesFilter(msg, { types: ["task.assigned"], agentId: createAgentId("agent-2") })).toBe(false)
    expect(matchesFilter(msg, { types: ["task.completed"], agentId: createAgentId("agent-1") })).toBe(false)
  })
})

describe("enriched message fields", () => {
  const base = { id: createMessageId(), timestamp: new Date() }

  it("task.completed has agentId", () => {
    const msg: Message = { ...base, type: "task.completed", taskId: createTaskId(), agentId: createAgentId("dev-1") }
    expect(msg.agentId).toBe("dev-1")
  })

  it("task.failed has agentId", () => {
    const msg: Message = { ...base, type: "task.failed", taskId: createTaskId(), agentId: createAgentId("dev-1"), reason: "oops" }
    expect(msg.agentId).toBe("dev-1")
  })

  it("code.completed has branch, filesChanged, testsWritten", () => {
    const msg: Message = {
      ...base, type: "code.completed", taskId: createTaskId(), artifactId: createArtifactId(),
      branch: "devfleet/task-1", filesChanged: 3, testsWritten: 2,
    }
    expect(msg.branch).toBe("devfleet/task-1")
    expect(msg.filesChanged).toBe(3)
  })

  it("goal.completed has costUsd", () => {
    const msg: Message = { ...base, type: "goal.completed", goalId: createGoalId(), costUsd: 0.42 }
    expect(msg.costUsd).toBe(0.42)
  })

  it("branch.merged has commit", () => {
    const msg: Message = { ...base, type: "branch.merged", taskId: createTaskId(), branch: "feat", commit: "abc123" }
    expect(msg.commit).toBe("abc123")
  })

  it("branch.discarded has reason", () => {
    const msg: Message = { ...base, type: "branch.discarded", taskId: createTaskId(), branch: "feat", reason: "max retries" }
    expect(msg.reason).toBe("max retries")
  })

  it("review.rejected has reasons array", () => {
    const msg: Message = { ...base, type: "review.rejected", taskId: createTaskId(), reviewerId: createAgentId("rev-1"), reasons: ["no tests"] }
    expect(msg.reasons).toEqual(["no tests"])
  })

  it("budget.exceeded has tokensUsed and budgetMax", () => {
    const msg: Message = { ...base, type: "budget.exceeded", taskId: createTaskId(), agentId: createAgentId("dev-1"), tokensUsed: 10000, budgetMax: 8000 }
    expect(msg.tokensUsed).toBe(10000)
  })

  it("agent.stuck has retryCount", () => {
    const msg: Message = { ...base, type: "agent.stuck", agentId: createAgentId("dev-1"), taskId: createTaskId(), reason: "timeout", retryCount: 2 }
    expect(msg.retryCount).toBe(2)
  })
})
