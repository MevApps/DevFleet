import type { GoalId } from "../entities/ids"
import type { AgentPromptBuilder } from "./ports/AgentPromptBuilder"
import type { ProjectContextProvider } from "./ports/ProjectContextProvider"
import type { ArtifactChain } from "./ports/ArtifactChain"

export class ContextAwarePromptBuilder implements AgentPromptBuilder {
  constructor(
    private readonly contextProvider: ProjectContextProvider,
    private readonly artifactChain: ArtifactChain,
  ) {}

  async build(rolePrompt: string, goalId: GoalId): Promise<string> {
    const ctx = await this.contextProvider.getContext()
    const artifacts = await this.artifactChain.gather(goalId)

    const sections: string[] = [rolePrompt]

    if (ctx.claudeMd) {
      sections.push(ctx.claudeMd)
    }

    sections.push([
      `Language: ${ctx.projectConfig.language}`,
      `Build: ${ctx.projectConfig.buildCommand}`,
      `Test: ${ctx.projectConfig.testCommand}`,
      `Source roots: ${ctx.projectConfig.sourceRoots.join(", ")}`,
    ].join("\n"))

    if (ctx.fileTree) {
      sections.push(`File structure:\n${ctx.fileTree}`)
    }

    if (artifacts.length > 0) {
      const artifactSections = artifacts.map(
        a => `### ${a.phase} (${a.kind})\n${a.content}`
      )
      sections.push(`## Prior work\n${artifactSections.join("\n\n")}`)
    }

    return sections.join("\n\n")
  }
}
