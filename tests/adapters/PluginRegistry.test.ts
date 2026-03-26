import { PluginRegistry } from "@adapters/plugins/PluginRegistry"
import { InMemoryBus } from "@adapters/messaging/InMemoryBus"
import type { RegisteredPlugin, PluginMessageHandler } from "@plugin-sdk/interfaces"
import type { Message } from "@entities/Message"
import { createMessageId, createTaskId, createGoalId } from "@entities/ids"

function makePlugin(id: string, messageHandler?: PluginMessageHandler): RegisteredPlugin {
  return {
    identity: {
      id,
      name: `Plugin ${id}`,
      version: "1.0.0",
      description: `Test plugin ${id}`,
    },
    lifecycle: {
      start: jest.fn().mockResolvedValue(undefined),
      stop: jest.fn().mockResolvedValue(undefined),
      healthCheck: jest.fn().mockResolvedValue("healthy"),
    },
    messageHandler,
  }
}

function makeTaskCreatedMsg(): Message {
  return {
    id: createMessageId(),
    type: "task.created",
    taskId: createTaskId(),
    goalId: createGoalId(),
    description: "Test",
    timestamp: new Date(),
  }
}

describe("PluginRegistry", () => {
  let bus: InMemoryBus
  let registry: PluginRegistry

  beforeEach(() => {
    bus = new InMemoryBus()
    registry = new PluginRegistry(bus)
  })

  describe("register / discover", () => {
    it("discovers registered plugins", () => {
      const p = makePlugin("p1")
      registry.register(p)
      expect(registry.discover()).toHaveLength(1)
      expect(registry.discover()[0]?.identity.id).toBe("p1")
    })

    it("discovers multiple plugins", () => {
      registry.register(makePlugin("p1"))
      registry.register(makePlugin("p2"))
      expect(registry.discover()).toHaveLength(2)
    })

    it("returns empty array before any registration", () => {
      expect(registry.discover()).toHaveLength(0)
    })
  })

  describe("startAll / stopAll", () => {
    it("calls start on all plugins", async () => {
      const p1 = makePlugin("p1")
      const p2 = makePlugin("p2")
      registry.register(p1)
      registry.register(p2)
      await registry.startAll()
      expect(p1.lifecycle.start).toHaveBeenCalledTimes(1)
      expect(p2.lifecycle.start).toHaveBeenCalledTimes(1)
    })

    it("calls stop on all plugins", async () => {
      const p1 = makePlugin("p1")
      const p2 = makePlugin("p2")
      registry.register(p1)
      registry.register(p2)
      await registry.stopAll()
      expect(p1.lifecycle.stop).toHaveBeenCalledTimes(1)
      expect(p2.lifecycle.stop).toHaveBeenCalledTimes(1)
    })
  })

  describe("message routing", () => {
    it("routes bus messages to plugin message handler", async () => {
      const received: Message[] = []
      const messageHandler: PluginMessageHandler = {
        subscriptions: () => [{ types: ["task.created"] }],
        handle: jest.fn().mockImplementation(async (msg: Message) => {
          received.push(msg)
        }),
      }

      const plugin = makePlugin("p1", messageHandler)
      registry.register(plugin)

      const msg = makeTaskCreatedMsg()
      await bus.emit(msg)

      expect(received).toHaveLength(1)
      expect(received[0]).toBe(msg)
    })

    it("does not route non-matching messages", async () => {
      const received: Message[] = []
      const messageHandler: PluginMessageHandler = {
        subscriptions: () => [{ types: ["goal.completed"] }],
        handle: jest.fn().mockImplementation(async (msg: Message) => {
          received.push(msg)
        }),
      }

      registry.register(makePlugin("p1", messageHandler))
      await bus.emit(makeTaskCreatedMsg())

      expect(received).toHaveLength(0)
    })
  })

  describe("deregister", () => {
    it("removes plugin from discover list", () => {
      registry.register(makePlugin("p1"))
      registry.deregister("p1")
      expect(registry.discover()).toHaveLength(0)
    })

    it("unsubscribes from bus on deregister", async () => {
      const received: Message[] = []
      const messageHandler: PluginMessageHandler = {
        subscriptions: () => [{ types: ["task.created"] }],
        handle: jest.fn().mockImplementation(async (msg: Message) => {
          received.push(msg)
        }),
      }

      registry.register(makePlugin("p1", messageHandler))
      await bus.emit(makeTaskCreatedMsg())
      expect(received).toHaveLength(1)

      registry.deregister("p1")
      await bus.emit(makeTaskCreatedMsg())
      expect(received).toHaveLength(1) // No new messages
    })

    it("is a no-op for unknown pluginId", () => {
      expect(() => registry.deregister("nonexistent")).not.toThrow()
    })
  })
})
