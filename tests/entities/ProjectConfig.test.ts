import { createProjectConfig, UNKNOWN_PROJECT_CONFIG, type ProjectConfig } from "../../src/entities/ProjectConfig"

describe("ProjectConfig", () => {
  it("creates a valid project config", () => {
    const config = createProjectConfig({
      language: "typescript",
      buildCommand: "npm run build",
      testCommand: "npm test",
      installCommand: "npm install",
      sourceRoots: ["src"],
    })

    expect(config.language).toBe("typescript")
    expect(config.buildCommand).toBe("npm run build")
    expect(config.testCommand).toBe("npm test")
    expect(config.installCommand).toBe("npm install")
    expect(config.sourceRoots).toEqual(["src"])
  })

  it("freezes the returned object", () => {
    const config = createProjectConfig({
      language: "rust",
      buildCommand: "cargo build",
      testCommand: "cargo test",
      installCommand: "cargo build",
      sourceRoots: ["src"],
    })

    expect(() => { (config as any).language = "go" }).toThrow()
  })

  it("provides UNKNOWN_PROJECT_CONFIG as default", () => {
    expect(UNKNOWN_PROJECT_CONFIG.language).toBe("unknown")
    expect(UNKNOWN_PROJECT_CONFIG.buildCommand).toBe("echo no-build")
    expect(UNKNOWN_PROJECT_CONFIG.testCommand).toBe("echo no-test")
    expect(UNKNOWN_PROJECT_CONFIG.installCommand).toBe("")
    expect(UNKNOWN_PROJECT_CONFIG.sourceRoots).toEqual(["."])
  })
})
