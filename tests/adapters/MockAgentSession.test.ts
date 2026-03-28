import { MockAgentSession } from "../../src/adapters/ai-providers/MockAgentSession"
import type { PhaseTask, SessionEvent } from "../../src/use-cases/ports/AgentSession"

function makeTask(overrides: Partial<PhaseTask> = {}): PhaseTask {
  return {
    systemPrompt: "You are a developer.",
    taskDescription: "Implement a feature",
    workingDir: "/tmp/test",
    capabilities: [],
    ...overrides,
  }
}

async function collectEvents(session: MockAgentSession, task: PhaseTask): Promise<SessionEvent[]> {
  const events: SessionEvent[] = []
  const controller = new AbortController()
  for await (const event of session.launch(task, controller.signal)) {
    events.push(event)
  }
  return events
}

describe("MockAgentSession", () => {
  it("emits started, turn_completed, and completed events", async () => {
    const session = new MockAgentSession()
    const events = await collectEvents(session, makeTask())

    expect(events[0]!.type).toBe("started")
    expect(events.some(e => e.type === "turn_completed")).toBe(true)
    expect(events[events.length - 1]!.type).toBe("completed")
  })

  it("returns role-appropriate content based on system prompt", async () => {
    const session = new MockAgentSession()

    const devEvents = await collectEvents(session, makeTask({ systemPrompt: "You are a developer agent." }))
    const completedDev = devEvents.find(e => e.type === "completed") as Extract<SessionEvent, { type: "completed" }>
    expect(completedDev.result).toContain("Implementation complete")

    const reviewEvents = await collectEvents(session, makeTask({ systemPrompt: "You are a code reviewer agent." }))
    const completedReview = reviewEvents.find(e => e.type === "completed") as Extract<SessionEvent, { type: "completed" }>
    expect(completedReview.result).toContain("APPROVED")
  })

  it("includes token counts in turn_completed", async () => {
    const session = new MockAgentSession()
    const events = await collectEvents(session, makeTask())

    const turnEvent = events.find(e => e.type === "turn_completed") as Extract<SessionEvent, { type: "turn_completed" }>
    expect(turnEvent.tokensIn).toBeGreaterThan(0)
    expect(turnEvent.tokensOut).toBeGreaterThan(0)
  })

  it("includes aggregate stats in completed event", async () => {
    const session = new MockAgentSession()
    const events = await collectEvents(session, makeTask())

    const completed = events.find(e => e.type === "completed") as Extract<SessionEvent, { type: "completed" }>
    expect(completed.totalTokensIn).toBeGreaterThan(0)
    expect(completed.totalTokensOut).toBeGreaterThan(0)
    expect(completed.durationMs).toBeGreaterThanOrEqual(0)
    expect(completed.numTurns).toBe(1)
  })
})
