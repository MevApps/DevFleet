import { toSystemEvent } from "@infrastructure/config/toSystemEvent"
import { createMessageId, createAgentId, createTaskId } from "@entities/ids"
import type { Message } from "@entities/Message"

describe("toSystemEvent", () => {
  it("extracts agentId, taskId from message", () => {
    const msg: Message = { id: createMessageId(), type: "task.assigned", taskId: createTaskId("t-1"), agentId: createAgentId("dev-1"), timestamp: new Date() }
    const event = toSystemEvent(msg)
    expect(event.type).toBe("task.assigned")
    expect(event.taskId).toBe("t-1")
    expect(event.agentId).toBe("dev-1")
    expect(event.goalId).toBeNull()
  })

  it("sets cost to null when message has no cost field", () => {
    const msg: Message = { id: createMessageId(), type: "goal.completed", goalId: createTaskId("g-1") as any, costUsd: 0.5, timestamp: new Date() }
    const event = toSystemEvent(msg)
    expect(event.cost).toBeNull()
  })
})
