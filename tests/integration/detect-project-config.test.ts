import { DetectProjectConfig } from "../../src/use-cases/DetectProjectConfig"
import { NodeFileSystem } from "../../src/adapters/filesystem/NodeFileSystem"

describe("DetectProjectConfig — integration", () => {
  it("detects DevFleet as a TypeScript project", async () => {
    const fs = new NodeFileSystem(process.cwd())
    const useCase = new DetectProjectConfig(fs)
    const config = await useCase.execute()

    expect(config.language).toBe("typescript")
    expect(config.buildCommand).toBe("npm run build")
    expect(config.testCommand).toBe("npm test")
    expect(config.installCommand).toBe("npm install")
    expect(config.sourceRoots).toContain("src")
  })
})
