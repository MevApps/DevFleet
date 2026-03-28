import type { FileSystem } from "./ports/FileSystem"
import { createProjectConfig, UNKNOWN_PROJECT_CONFIG, type ProjectConfig } from "../entities/ProjectConfig"

interface MarkerRule {
  readonly marker: string
  readonly language: string
  readonly buildCommand: string
  readonly testCommand: string
  readonly installCommand: string
  readonly sourceRoot: string
}

const MARKER_RULES: readonly MarkerRule[] = [
  { marker: "Cargo.toml", language: "rust", buildCommand: "cargo build", testCommand: "cargo test", installCommand: "cargo build", sourceRoot: "src" },
  { marker: "build.gradle.kts", language: "kotlin", buildCommand: "./gradlew build", testCommand: "./gradlew test", installCommand: "./gradlew build", sourceRoot: "src" },
  { marker: "go.mod", language: "go", buildCommand: "go build ./...", testCommand: "go test ./...", installCommand: "go mod download", sourceRoot: "." },
]

export class DetectProjectConfig {
  constructor(private readonly fs: FileSystem) {}

  async execute(): Promise<ProjectConfig> {
    // Check TypeScript/JavaScript (most common in this project)
    const hasPackageJson = await this.fs.exists("package.json")
    if (hasPackageJson) {
      const hasTsConfig = await this.fs.exists("tsconfig.json")
      const language = hasTsConfig ? "typescript" : "javascript"
      const sourceRoots = await this.detectSourceRoots()
      return createProjectConfig({
        language,
        buildCommand: "npm run build",
        testCommand: "npm test",
        installCommand: "npm install",
        sourceRoots,
      })
    }

    // Check other markers
    for (const rule of MARKER_RULES) {
      const exists = await this.fs.exists(rule.marker)
      if (exists) {
        return createProjectConfig({
          language: rule.language,
          buildCommand: rule.buildCommand,
          testCommand: rule.testCommand,
          installCommand: rule.installCommand,
          sourceRoots: [rule.sourceRoot],
        })
      }
    }

    return UNKNOWN_PROJECT_CONFIG
  }

  private async detectSourceRoots(): Promise<string[]> {
    const candidates = ["src", "lib", "app"]
    const roots: string[] = []
    const allFiles = await this.fs.glob("**/*")
    for (const candidate of candidates) {
      const directExists = await this.fs.exists(candidate)
      const hasChildren = allFiles.some((f) => f.startsWith(`${candidate}/`))
      if (directExists || hasChildren) roots.push(candidate)
    }
    return roots.length > 0 ? roots : ["."]
  }
}
