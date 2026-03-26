import { SendChannelMessage } from "../../src/use-cases/SendChannelMessage"
import { InMemoryAgentRegistry } from "../../src/adapters/storage/InMemoryAgentRegistry"
import { InMemoryBus } from "../../src/adapters/messaging/InMemoryBus"
import { createAgent } from "../../src/entities/Agent"
import { createAgentId } from "../../src/entities/ids"
import { createChannelMessage } from "../../src/entities/ChannelMessage"
import { ROLES } from "../../src/entities/AgentRole"

describe("SendChannelMessage", () => {
  let registry: InMemoryAgentRegistry
  let bus: InMemoryBus
  let useCase: SendChannelMessage

  beforeEach(async () => {
    registry = new InMemoryAgentRegistry()
    bus = new InMemoryBus()
    useCase = new SendChannelMessage(registry, bus)

    await registry.register(createAgent({ id: createAgentId("dev-1"), role: ROLES.DEVELOPER, model: "sonnet" }))
  })

  it("emits channel message for valid agent", async () => {
    const emitted: any[] = []
    bus.subscribe({}, async (msg) => { emitted.push(msg) })

    const msg = createChannelMessage({ from: createAgentId("dev-1"), to: "all", content: "hello" })
    const result = await useCase.execute(msg)
    expect(result.ok).toBe(true)
  })

  it("fails for unknown sender", async () => {
    const msg = createChannelMessage({ from: createAgentId("unknown"), to: "all", content: "hello" })
    const result = await useCase.execute(msg)
    expect(result.ok).toBe(false)
  })
})
