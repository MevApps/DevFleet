import { InMemoryEventStore } from "../../src/adapters/storage/InMemoryEventStore"
import { createEventId, createAgentId, createTaskId, createGoalId } from "../../src/entities/ids"
import type { SystemEvent } from "../../src/entities/Event"

function makeEvent(overrides: Partial<SystemEvent> = {}): SystemEvent {
  return {
    id: createEventId(),
    type: "task.assigned",
    agentId: createAgentId("agent-1"),
    taskId: createTaskId("task-1"),
    goalId: createGoalId("goal-1"),
    cost: null,
    occurredAt: new Date(),
    payload: null,
    ...overrides,
  }
}

describe("InMemoryEventStore", () => {
  let store: InMemoryEventStore

  beforeEach(() => {
    store = new InMemoryEventStore()
  })

  describe("findAll", () => {
    it("returns all events when no options given", async () => {
      await store.append(makeEvent())
      await store.append(makeEvent())
      const results = await store.findAll()
      expect(results).toHaveLength(2)
    })

    it("filters by event type", async () => {
      await store.append(makeEvent({ type: "task.assigned" }))
      await store.append(makeEvent({ type: "goal.created" }))
      const results = await store.findAll({ types: ["task.assigned"] })
      expect(results).toHaveLength(1)
      expect(results[0].type).toBe("task.assigned")
    })

    it("filters by agentId", async () => {
      await store.append(makeEvent({ agentId: createAgentId("a-1") }))
      await store.append(makeEvent({ agentId: createAgentId("a-2") }))
      const results = await store.findAll({ agentId: createAgentId("a-1") })
      expect(results).toHaveLength(1)
    })

    it("respects limit", async () => {
      for (let i = 0; i < 10; i++) await store.append(makeEvent())
      const results = await store.findAll({ limit: 3 })
      expect(results).toHaveLength(3)
    })

    it("respects offset", async () => {
      for (let i = 0; i < 5; i++) {
        await store.append(makeEvent({ type: i < 3 ? "task.assigned" : "goal.created" }))
      }
      const results = await store.findAll({ offset: 2, limit: 2 })
      expect(results).toHaveLength(2)
    })
  })

  describe("findRecent", () => {
    it("returns the N most recent events newest-first", async () => {
      const e1 = makeEvent({ occurredAt: new Date("2026-01-01") })
      const e2 = makeEvent({ occurredAt: new Date("2026-01-03") })
      const e3 = makeEvent({ occurredAt: new Date("2026-01-02") })
      await store.append(e1)
      await store.append(e2)
      await store.append(e3)
      const results = await store.findRecent(2)
      expect(results).toHaveLength(2)
      expect(results[0].id).toBe(e2.id)
      expect(results[1].id).toBe(e3.id)
    })
  })

  describe("countAll", () => {
    it("returns the total event count", async () => {
      await store.append(makeEvent())
      await store.append(makeEvent())
      await store.append(makeEvent())
      expect(await store.countAll()).toBe(3)
    })

    it("returns 0 when empty", async () => {
      expect(await store.countAll()).toBe(0)
    })
  })
})
