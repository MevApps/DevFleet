import { PauseAgent } from "../../src/use-cases/PauseAgent"
import { InMemoryAgentRegistry } from "../../src/adapters/storage/InMemoryAgentRegistry"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { createAgent } from "../../src/entities/Agent"
import { createAgentId } from "../../src/entities/ids"
import { ROLES } from "../../src/entities/AgentRole"
import type { Message } from "../../src/entities/Message"

describe("PauseAgent", () => {
  let registry: InMemoryAgentRegistry
  let bus: InMemoryBus
  let useCase: PauseAgent

  beforeEach(async () => {
    registry = new InMemoryAgentRegistry()
    bus = new InMemoryBus()
    useCase = new PauseAgent(registry, bus)
    await registry.register(createAgent({ id: createAgentId("dev-1"), role: ROLES.DEVELOPER, model: "sonnet", status: "busy" }))
  })

  it("pauses a busy agent", async () => {
    const result = await useCase.execute(createAgentId("dev-1"), "CEO requested pause")
    expect(result.ok).toBe(true)
    const agent = await registry.findById(createAgentId("dev-1"))
    expect(agent!.status).toBe("paused")
  })

  it("emits agent.paused message (not ceo.override with fake taskId)", async () => {
    const emitted: Message[] = []
    bus.subscribe({}, async (msg) => { emitted.push(msg) })
    await useCase.execute(createAgentId("dev-1"), "Testing pause")
    const paused = emitted.find(m => m.type === "agent.paused")
    expect(paused).toBeDefined()
    if (paused && paused.type === "agent.paused") {
      expect(paused.agentId).toBe("dev-1")
      expect(paused.reason).toBe("Testing pause")
    }
  })

  it("resumes a paused agent and emits agent.resumed", async () => {
    const emitted: Message[] = []
    bus.subscribe({}, async (msg) => { emitted.push(msg) })
    await useCase.execute(createAgentId("dev-1"), "pause")
    const result = await useCase.resume(createAgentId("dev-1"))
    expect(result.ok).toBe(true)
    const agent = await registry.findById(createAgentId("dev-1"))
    expect(agent!.status).toBe("idle")
    expect(emitted.some(m => m.type === "agent.resumed")).toBe(true)
  })

  it("fails when agent not found", async () => {
    const result = await useCase.execute(createAgentId("unknown"), "reason")
    expect(result.ok).toBe(false)
  })
})
