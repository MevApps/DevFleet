import { RouteMessage } from "../../src/use-cases/RouteMessage"
import type { MessagePort, MessageHandler, Unsubscribe } from "../../src/use-cases/ports/MessagePort"
import type { Message, MessageFilter } from "../../src/entities/Message"
import { createMessageId } from "../../src/entities/ids"

function makeMessage(type: Message["type"] = "goal.created"): Message {
  if (type === "goal.created") {
    return {
      id: createMessageId(),
      type: "goal.created",
      goalId: "g1" as Message extends { goalId: infer G } ? G : never,
      description: "test goal",
      timestamp: new Date(),
    } as Message
  }
  return {
    id: createMessageId(),
    type: "schedule.ideation",
    timestamp: new Date(),
  } as Message
}

describe("RouteMessage", () => {
  it("emits the message through the bus and returns success", async () => {
    const emitted: Message[] = []
    const bus: MessagePort = {
      emit: async (msg) => { emitted.push(msg) },
      subscribe: (_filter: MessageFilter, _handler: MessageHandler): Unsubscribe => () => undefined,
    }
    const uc = new RouteMessage(bus)
    const msg = makeMessage("goal.created")
    const result = await uc.execute(msg)
    expect(result.ok).toBe(true)
    expect(emitted).toHaveLength(1)
    expect(emitted[0]).toBe(msg)
  })

  it("returns failure if bus.emit throws", async () => {
    const bus: MessagePort = {
      emit: async () => { throw new Error("bus down") },
      subscribe: (_filter: MessageFilter, _handler: MessageHandler): Unsubscribe => () => undefined,
    }
    const uc = new RouteMessage(bus)
    const result = await uc.execute(makeMessage())
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.error).toContain("bus down")
    }
  })

  it("delivers to matching subscriber", async () => {
    const received: Message[] = []
    const handlers: Array<{ filter: MessageFilter; handler: MessageHandler }> = []

    const bus: MessagePort = {
      emit: async (msg) => {
        for (const { filter, handler } of handlers) {
          if (!filter.types || filter.types.includes(msg.type)) {
            await handler(msg)
          }
        }
      },
      subscribe: (filter, handler) => {
        handlers.push({ filter, handler })
        return () => undefined
      },
    }

    bus.subscribe({ types: ["goal.created"] }, async (m) => { received.push(m) })
    const uc = new RouteMessage(bus)
    await uc.execute(makeMessage("goal.created"))

    expect(received).toHaveLength(1)
  })

  it("does not deliver to non-matching subscriber", async () => {
    const received: Message[] = []
    const handlers: Array<{ filter: MessageFilter; handler: MessageHandler }> = []

    const bus: MessagePort = {
      emit: async (msg) => {
        for (const { filter, handler } of handlers) {
          if (!filter.types || filter.types.includes(msg.type)) {
            await handler(msg)
          }
        }
      },
      subscribe: (filter, handler) => {
        handlers.push({ filter, handler })
        return () => undefined
      },
    }

    bus.subscribe({ types: ["schedule.ideation"] }, async (m) => { received.push(m) })
    const uc = new RouteMessage(bus)
    await uc.execute(makeMessage("goal.created"))

    expect(received).toHaveLength(0)
  })
})
