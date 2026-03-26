import {
  matchesFilter,
  type Message,
  type MessageFilter,
} from "../../src/entities/Message"
import { createMessageId, createGoalId, createTaskId, createAgentId } from "../../src/entities/ids"

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
