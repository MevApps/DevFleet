import { createAgent, isAvailable } from "../../src/entities/Agent"
import { createAgentId } from "../../src/entities/ids"
import { ROLES } from "../../src/entities/AgentRole"

describe("Agent", () => {
  it("creates agent with default lastActiveAt", () => {
    const before = new Date()
    const agent = createAgent({ id: createAgentId("a-1"), role: ROLES.DEVELOPER, model: "sonnet" })
    const after = new Date()
    expect(agent.lastActiveAt.getTime()).toBeGreaterThanOrEqual(before.getTime())
    expect(agent.lastActiveAt.getTime()).toBeLessThanOrEqual(after.getTime())
  })
  it("creates agent with explicit lastActiveAt", () => {
    const date = new Date("2026-01-01")
    const agent = createAgent({ id: createAgentId("a-1"), role: ROLES.DEVELOPER, model: "sonnet", lastActiveAt: date })
    expect(agent.lastActiveAt).toBe(date)
  })
  it("isAvailable returns true for idle agent with no task", () => {
    const agent = createAgent({ id: createAgentId("a-1"), role: ROLES.DEVELOPER, model: "sonnet" })
    expect(isAvailable(agent)).toBe(true)
  })
  it("isAvailable returns false for busy agent", () => {
    const agent = createAgent({ id: createAgentId("a-1"), role: ROLES.DEVELOPER, model: "sonnet", status: "busy" })
    expect(isAvailable(agent)).toBe(false)
  })
})
