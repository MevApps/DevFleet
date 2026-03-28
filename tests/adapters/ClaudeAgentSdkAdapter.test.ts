import { mapCapabilities } from "../../src/adapters/ai-providers/ClaudeAgentSdkAdapter"
import type { AgentCapability } from "../../src/use-cases/ports/AgentSession"

describe("mapCapabilities", () => {
  it("maps file_access to Read, Write, Edit, Glob, Grep", () => {
    const tools = mapCapabilities(["file_access"])
    expect(tools).toEqual(["Read", "Write", "Edit", "Glob", "Grep"])
  })

  it("maps shell to Bash", () => {
    const tools = mapCapabilities(["shell"])
    expect(tools).toEqual(["Bash"])
  })

  it("maps multiple capabilities without duplicates", () => {
    const tools = mapCapabilities(["file_access", "shell"])
    expect(tools).toEqual(["Read", "Write", "Edit", "Glob", "Grep", "Bash"])
  })

  it("returns empty array for no capabilities", () => {
    const tools = mapCapabilities([])
    expect(tools).toEqual([])
  })
})
