import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import type { Message } from "@entities/Message"
import { createMessageId, createTaskId, createGoalId } from "@entities/ids"

function makeTaskCreated(): Message {
  return {
    id: createMessageId(),
    type: "task.created",
    taskId: createTaskId(),
    goalId: createGoalId(),
    description: "Test task",
    timestamp: new Date(),
  }
}

function makeGoalCreated(): Message {
  return {
    id: createMessageId(),
    type: "goal.created",
    goalId: createGoalId(),
    description: "Test goal",
    timestamp: new Date(),
  }
}

describe("InMemoryBus", () => {
  let bus: InMemoryBus

  beforeEach(() => {
    bus = new InMemoryBus()
  })

  describe("subscribe and emit", () => {
    it("delivers message to matching subscriber", async () => {
      const received: Message[] = []
      bus.subscribe({ types: ["task.created"] }, async msg => {
        received.push(msg)
      })

      const msg = makeTaskCreated()
      await bus.emit(msg)

      expect(received).toHaveLength(1)
      expect(received[0]).toBe(msg)
    })

    it("does not deliver message to non-matching subscriber", async () => {
      const received: Message[] = []
      bus.subscribe({ types: ["goal.completed"] }, async msg => {
        received.push(msg)
      })

      await bus.emit(makeTaskCreated())

      expect(received).toHaveLength(0)
    })

    it("delivers to multiple matching subscribers", async () => {
      const counts = [0, 0]
      bus.subscribe({ types: ["task.created"] }, async () => { counts[0]++ })
      bus.subscribe({ types: ["task.created"] }, async () => { counts[1]++ })

      await bus.emit(makeTaskCreated())

      expect(counts[0]).toBe(1)
      expect(counts[1]).toBe(1)
    })

    it("delivers message with no filter types to all subscribers", async () => {
      const received: Message[] = []
      bus.subscribe({}, async msg => { received.push(msg) })

      await bus.emit(makeTaskCreated())
      await bus.emit(makeGoalCreated())

      expect(received).toHaveLength(2)
    })

    it("dispatches handlers in parallel (Promise.all)", async () => {
      const order: number[] = []
      bus.subscribe({ types: ["task.created"] }, async () => {
        await new Promise<void>(r => setTimeout(r, 20))
        order.push(1)
      })
      bus.subscribe({ types: ["task.created"] }, async () => {
        await new Promise<void>(r => setTimeout(r, 5))
        order.push(2)
      })

      await bus.emit(makeTaskCreated())

      // If parallel, the 5ms handler finishes first (order = [2, 1])
      expect(order).toEqual([2, 1])
    })
  })

  describe("unsubscribe", () => {
    it("stops delivering after unsubscribe", async () => {
      const received: Message[] = []
      const unsub = bus.subscribe({ types: ["task.created"] }, async msg => {
        received.push(msg)
      })

      await bus.emit(makeTaskCreated())
      expect(received).toHaveLength(1)

      unsub()
      await bus.emit(makeTaskCreated())
      expect(received).toHaveLength(1)
    })

    it("unsubscribing once does not affect other subscribers", async () => {
      const received: Message[] = []
      const unsub = bus.subscribe({ types: ["task.created"] }, async () => {})
      bus.subscribe({ types: ["task.created"] }, async msg => { received.push(msg) })

      unsub()
      await bus.emit(makeTaskCreated())

      expect(received).toHaveLength(1)
    })
  })
})
