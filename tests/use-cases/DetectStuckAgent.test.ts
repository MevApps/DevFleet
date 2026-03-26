import { DetectStuckAgent } from "../../src/use-cases/DetectStuckAgent"
import { InMemoryAgentRegistry } from "../../src/adapters/storage/InMemoryAgentRegistry"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { createAgent } from "../../src/entities/Agent"
import { createAgentId, createTaskId } from "../../src/entities/ids"
import { ROLES } from "../../src/entities/AgentRole"
import type { Message } from "../../src/entities/Message"

describe("DetectStuckAgent", () => {
  let registry: InMemoryAgentRegistry
  let bus: InMemoryBus
  let useCase: DetectStuckAgent
  const emitted: Message[] = []

  beforeEach(() => {
    registry = new InMemoryAgentRegistry()
    bus = new InMemoryBus()
    useCase = new DetectStuckAgent(registry, bus)
    emitted.length = 0
    bus.subscribe({}, async (msg) => { emitted.push(msg) })
  })

  it("emits agent.stuck for agent inactive beyond timeout", async () => {
    const staleDate = new Date(Date.now() - 120_000) // 2 min ago
    const agent = createAgent({
      id: createAgentId("dev-1"), role: ROLES.DEVELOPER, model: "sonnet",
      status: "busy", currentTaskId: createTaskId("t-1"), lastActiveAt: staleDate,
    })
    await registry.register(agent)

    await useCase.execute(60_000) // 60s timeout
    expect(emitted).toHaveLength(1)
    expect(emitted[0].type).toBe("agent.stuck")
  })

  it("does not emit for active agent", async () => {
    const agent = createAgent({
      id: createAgentId("dev-1"), role: ROLES.DEVELOPER, model: "sonnet",
      status: "busy", currentTaskId: createTaskId("t-1"), lastActiveAt: new Date(),
    })
    await registry.register(agent)

    await useCase.execute(60_000)
    expect(emitted).toHaveLength(0)
  })

  it("does not emit for idle agent", async () => {
    const staleDate = new Date(Date.now() - 120_000)
    const agent = createAgent({
      id: createAgentId("dev-1"), role: ROLES.DEVELOPER, model: "sonnet",
      status: "idle", lastActiveAt: staleDate,
    })
    await registry.register(agent)

    await useCase.execute(60_000)
    expect(emitted).toHaveLength(0)
  })
})
