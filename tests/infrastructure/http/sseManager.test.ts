import { SSEManager } from "../../../src/infrastructure/http/sseManager"
import { InMemoryBus } from "../../../src/adapters/messaging/InMemoryBus"
import { createMessageId, createGoalId } from "../../../src/entities/ids"

function createMockResponse() {
  const mock = {
    written: [] as string[],
    headersSent: false,
    writeHead: jest.fn(() => {
      mock.headersSent = true
    }),
    write: jest.fn((data: string) => {
      mock.written.push(data)
    }),
    on: jest.fn((event: string, cb: () => void) => {
      if (event === "close") mock.onClose = cb
    }),
    onClose: null as (() => void) | null,
  }
  return mock
}

describe("SSEManager", () => {
  let bus: InMemoryBus
  let manager: SSEManager

  beforeEach(() => {
    bus = new InMemoryBus()
    manager = new SSEManager(bus)
  })

  afterEach(() => {
    manager.shutdown()
  })

  it("sends SSE-formatted data on bus message", async () => {
    const res = createMockResponse()
    manager.addClient(res as any)

    await bus.emit({
      id: createMessageId(),
      type: "goal.created",
      goalId: createGoalId("g-1"),
      description: "Test goal",
      timestamp: new Date(),
    })

    expect(res.written.length).toBeGreaterThan(0)
    const data = res.written.find((w) => w.startsWith("data:"))
    expect(data).toBeDefined()
    const parsed = JSON.parse(data!.replace("data:", "").trim())
    expect(parsed.type).toBe("goal.created")
  })

  it("removes client on close", async () => {
    const res = createMockResponse()
    manager.addClient(res as any)
    expect(manager.clientCount).toBe(1)
    res.onClose!()
    expect(manager.clientCount).toBe(0)
  })
})
