import { describe, it, expect } from "vitest"
import { ContextAwarePromptBuilder } from "../../src/use-cases/ContextAwarePromptBuilder"
import type { ProjectContextProvider, ProjectContext } from "../../src/use-cases/ports/ProjectContextProvider"
import type { ArtifactChain, PhaseArtifact } from "../../src/use-cases/ports/ArtifactChain"
import { createProjectConfig } from "../../src/entities/ProjectConfig"
import { createGoalId } from "../../src/entities/ids"

function fakeContextProvider(ctx: Partial<ProjectContext> = {}): ProjectContextProvider {
  return {
    getContext: async () => ({
      claudeMd: ctx.claudeMd ?? "# Rules\nUse TypeScript.",
      projectConfig: ctx.projectConfig ?? createProjectConfig({
        language: "typescript",
        buildCommand: "npm run build",
        testCommand: "npm test",
        installCommand: "npm install",
        sourceRoots: ["src"],
      }),
      fileTree: ctx.fileTree ?? "src/\n  index.ts",
    }),
  }
}

function fakeArtifactChain(artifacts: PhaseArtifact[] = []): ArtifactChain {
  return { gather: async () => artifacts }
}

describe("ContextAwarePromptBuilder", () => {
  it("combines role prompt, CLAUDE.md, project config, file tree, and artifacts", async () => {
    const builder = new ContextAwarePromptBuilder(
      fakeContextProvider(),
      fakeArtifactChain([
        { phase: "spec", kind: "spec", content: "Build a button component" },
        { phase: "plan", kind: "plan", content: "Step 1: Create button.tsx" },
      ]),
    )

    const prompt = await builder.build("You are a developer.", createGoalId("g-1"))

    expect(prompt).toContain("You are a developer.")
    expect(prompt).toContain("# Rules")
    expect(prompt).toContain("typescript")
    expect(prompt).toContain("src/\n  index.ts")
    expect(prompt).toContain("Build a button component")
    expect(prompt).toContain("Step 1: Create button.tsx")
  })

  it("works with no CLAUDE.md and no prior artifacts", async () => {
    const builder = new ContextAwarePromptBuilder(
      fakeContextProvider({ claudeMd: "" }),
      fakeArtifactChain([]),
    )

    const prompt = await builder.build("You are a reviewer.", createGoalId("g-1"))

    expect(prompt).toContain("You are a reviewer.")
    expect(prompt).toContain("typescript")
    expect(prompt).not.toContain("Prior work")
  })
})
