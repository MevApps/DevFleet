import { DetectProjectConfig } from "../../src/use-cases/DetectProjectConfig"
import type { FileSystem } from "../../src/use-cases/ports/FileSystem"

function mockFs(files: Record<string, string>): FileSystem {
  return {
    async read(path: string) {
      if (files[path] !== undefined) return files[path]!
      throw new Error(`File not found: ${path}`)
    },
    async write() {},
    async edit() {},
    async glob() { return Object.keys(files) },
    async exists(path: string) { return files[path] !== undefined },
  }
}

describe("DetectProjectConfig", () => {
  it("detects TypeScript project (package.json + tsconfig.json)", async () => {
    const fs = mockFs({ "package.json": '{"name":"test"}', "tsconfig.json": '{}' })
    const useCase = new DetectProjectConfig(fs)
    const config = await useCase.execute()
    expect(config.language).toBe("typescript")
    expect(config.buildCommand).toBe("npm run build")
    expect(config.testCommand).toBe("npm test")
    expect(config.installCommand).toBe("npm install")
  })

  it("detects JavaScript project (package.json only)", async () => {
    const fs = mockFs({ "package.json": '{"name":"test"}' })
    const useCase = new DetectProjectConfig(fs)
    const config = await useCase.execute()
    expect(config.language).toBe("javascript")
  })

  it("detects Rust project", async () => {
    const fs = mockFs({ "Cargo.toml": "" })
    const useCase = new DetectProjectConfig(fs)
    const config = await useCase.execute()
    expect(config.language).toBe("rust")
    expect(config.buildCommand).toBe("cargo build")
    expect(config.testCommand).toBe("cargo test")
    expect(config.installCommand).toBe("cargo build")
  })

  it("detects Kotlin project", async () => {
    const fs = mockFs({ "build.gradle.kts": "" })
    const useCase = new DetectProjectConfig(fs)
    const config = await useCase.execute()
    expect(config.language).toBe("kotlin")
    expect(config.buildCommand).toBe("./gradlew build")
    expect(config.testCommand).toBe("./gradlew test")
    expect(config.installCommand).toBe("./gradlew build")
  })

  it("detects Go project", async () => {
    const fs = mockFs({ "go.mod": "" })
    const useCase = new DetectProjectConfig(fs)
    const config = await useCase.execute()
    expect(config.language).toBe("go")
    expect(config.buildCommand).toBe("go build ./...")
    expect(config.testCommand).toBe("go test ./...")
    expect(config.installCommand).toBe("go mod download")
  })

  it("returns unknown config for empty directory", async () => {
    const fs = mockFs({})
    const useCase = new DetectProjectConfig(fs)
    const config = await useCase.execute()
    expect(config.language).toBe("unknown")
  })

  it("detects sourceRoots for TypeScript (src/ exists)", async () => {
    const fs = mockFs({ "package.json": '{}', "tsconfig.json": '{}', "src/index.ts": "" })
    const useCase = new DetectProjectConfig(fs)
    const config = await useCase.execute()
    expect(config.sourceRoots).toContain("src")
    expect(config.installCommand).toBe("npm install")
  })
})
