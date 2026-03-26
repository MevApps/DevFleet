import { waitForMessage } from "./waitForMessage"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { createMessageId, createGoalId } from "../../src/entities/ids"

describe("waitForMessage", () => {
  it("resolves when matching message is emitted", async () => {
    const bus = new InMemoryBus()

    const promise = waitForMessage(bus, "goal.created")
    await bus.emit({
      id: createMessageId(),
      type: "goal.created",
      goalId: createGoalId(),
      description: "test",
      timestamp: new Date(),
    })

    const msg = await promise
    expect(msg.type).toBe("goal.created")
  })

  it("rejects on timeout", async () => {
    const bus = new InMemoryBus()
    await expect(waitForMessage(bus, "goal.created", undefined, 50)).rejects.toThrow("Timed out")
  })

  it("filters with predicate", async () => {
    const bus = new InMemoryBus()
    const gid = createGoalId("specific")

    const promise = waitForMessage(
      bus,
      "goal.created",
      (msg) => msg.type === "goal.created" && "goalId" in msg && (msg as any).goalId === gid,
      2000,
    )

    // Emit a non-matching message first
    await bus.emit({ id: createMessageId(), type: "goal.created", goalId: createGoalId("other"), description: "other", timestamp: new Date() })
    // Then the matching one
    await bus.emit({ id: createMessageId(), type: "goal.created", goalId: gid, description: "specific", timestamp: new Date() })

    const msg = await promise
    expect(msg.type).toBe("goal.created")
  })
})
