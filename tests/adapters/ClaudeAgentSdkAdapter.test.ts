import { describe, it, expect } from "vitest"
import { mapCapabilities } from "../../src/adapters/ai-providers/ClaudeAgentSdkAdapter"

describe("ClaudeAgentSdkAdapter", () => {
  describe("mapCapabilities", () => {
    it("maps file_access to file tools", () => {
      const tools = mapCapabilities(["file_access"])
      expect(tools).toContain("Read")
      expect(tools).toContain("Write")
      expect(tools).toContain("Edit")
      expect(tools).toContain("Glob")
      expect(tools).toContain("Grep")
    })

    it("maps shell to Bash", () => {
      const tools = mapCapabilities(["shell"])
      expect(tools).toContain("Bash")
    })

    it("combines multiple capabilities", () => {
      const tools = mapCapabilities(["file_access", "shell"])
      expect(tools).toHaveLength(6)
    })
  })
})
