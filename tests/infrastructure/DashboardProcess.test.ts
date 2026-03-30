import { describe, it, expect } from "vitest"
import { DashboardProcess } from "../../src/infrastructure/cli/DashboardProcess"

describe("DashboardProcess", () => {
  it("returns null when no dashboard directory exists", async () => {
    const result = await DashboardProcess.discover(9999, "/tmp/nonexistent-dir-xyz")
    expect(result).toBeNull()
  })
})
