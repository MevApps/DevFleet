import { createChannelMessage } from "../../src/entities/ChannelMessage"
import { createAgentId, createTaskId, createMessageId } from "../../src/entities/ids"

describe("ChannelMessage", () => {
  it("creates a message with defaults", () => {
    const from = createAgentId("agent-1")
    const to = createAgentId("agent-2")
    const before = new Date()
    const msg = createChannelMessage({ from, to, content: "Hello" })
    const after = new Date()
    expect(msg.from).toBe(from)
    expect(msg.to).toBe(to)
    expect(msg.content).toBe("Hello")
    expect(msg.taskId).toBeNull()
    expect(msg.replyTo).toBeNull()
    expect(msg.timestamp.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(msg.timestamp.getTime()).toBeLessThanOrEqual(after.getTime())
    expect(typeof msg.id).toBe("string")
  })

  it("creates a broadcast message to 'all'", () => {
    const from = createAgentId("supervisor")
    const msg = createChannelMessage({ from, to: "all", content: "Broadcast!" })
    expect(msg.to).toBe("all")
  })

  it("creates a message with explicit taskId and replyTo", () => {
    const from = createAgentId("agent-a")
    const to = createAgentId("agent-b")
    const taskId = createTaskId("t-42")
    const replyTo = createMessageId("m-1")
    const id = createMessageId("m-2")
    const timestamp = new Date("2026-01-15")
    const msg = createChannelMessage({ from, to, content: "Reply", taskId, replyTo, id, timestamp })
    expect(msg.taskId).toBe(taskId)
    expect(msg.replyTo).toBe(replyTo)
    expect(msg.id).toBe(id)
    expect(msg.timestamp).toBe(timestamp)
  })
})
