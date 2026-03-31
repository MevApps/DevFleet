import type { AgentId, ProjectId } from "../../../entities/ids"
import { createMessageId, createArtifactId } from "../../../entities/ids"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../../use-cases/ports/PluginInterfaces"
import type { AgentExecutor } from "../../../use-cases/ports/AgentExecutor"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import type { ArtifactRepository } from "../../../use-cases/ports/ArtifactRepository"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import type { CreateArtifactUseCase } from "../../../use-cases/CreateArtifact"
import type { AgentPromptBuilder } from "../../../use-cases/ports/AgentPromptBuilder"
import { createArtifact } from "../../../entities/Artifact"
import { ROLES } from "../../../entities/AgentRole"

export interface ArchitectPluginDeps {
  readonly agentId: AgentId
  readonly projectId: ProjectId
  readonly executor: AgentExecutor
  readonly taskRepo: TaskRepository
  readonly artifactRepo: ArtifactRepository
  readonly createArtifact: CreateArtifactUseCase
  readonly bus: MessagePort
  readonly promptBuilder: AgentPromptBuilder
  readonly systemPrompt: string
  readonly model: string
  readonly projectDir: string
}

export class ArchitectPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  readonly id: string
  readonly name = "architect-agent"
  readonly version = "1.0.0"
  readonly description = "Architect agent that creates implementation plans"

  private readonly deps: ArchitectPluginDeps

  constructor(deps: ArchitectPluginDeps) {
    this.deps = deps
    this.id = `architect-${deps.agentId}`
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async healthCheck(): Promise<HealthStatus> { return "healthy" }

  subscriptions(): ReadonlyArray<MessageFilter> {
    return [{ types: ["task.assigned"], agentId: this.deps.agentId }]
  }

  async handle(message: Message): Promise<void> {
    if (message.type !== "task.assigned") return
    if (message.agentId !== this.deps.agentId) return

    const task = await this.deps.taskRepo.findById(message.taskId)
    if (!task) return

    const systemPrompt = await this.deps.promptBuilder.build(this.deps.systemPrompt, task.goalId)

    const config = {
      role: ROLES.ARCHITECT,
      systemPrompt,
      capabilities: [],
      model: this.deps.model,
      budget: task.budget,
      workingDir: this.deps.projectDir,
    }

    let content = ""
    for await (const event of this.deps.executor.run(this.deps.agentId, config, task, this.deps.projectId)) {
      if (event.type === "task_completed" && typeof event.data["content"] === "string") {
        content = event.data["content"] as string
      }
    }

    if (content) {
      const artifact = createArtifact({
        id: createArtifactId(),
        kind: "plan",
        format: "markdown",
        taskId: task.id,
        createdBy: this.deps.agentId,
        content,
        metadata: {
          stepCount: (content.match(/^##\s+Step/gm) || []).length,
          estimatedTokens: content.length * 2,
        },
      })
      await this.deps.createArtifact.execute(artifact)
    }

    await this.deps.bus.emit({
      id: createMessageId(),
      type: "task.completed",
      taskId: message.taskId,
      agentId: this.deps.agentId,
      timestamp: new Date(),
    })
  }
}
