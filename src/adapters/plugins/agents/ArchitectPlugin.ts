import type { AgentId, ProjectId } from "../../../entities/ids"
import { createMessageId, createArtifactId } from "../../../entities/ids"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../../use-cases/ports/PluginInterfaces"
import type { AgentExecutor } from "../../../use-cases/ports/AgentExecutor"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import type { ArtifactRepository } from "../../../use-cases/ports/ArtifactRepository"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import type { CreateArtifactUseCase } from "../../../use-cases/CreateArtifact"
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
  readonly systemPrompt: string
  readonly model: string
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

    // Read spec artifact if available — look up by artifact IDs attached to the task
    const artifactObjects = await Promise.all(
      task.artifacts.map(id => this.deps.artifactRepo.findById(id))
    )
    const specArtifact = artifactObjects.find(a => a !== null && a.kind === "spec") ?? null
    const specContext = specArtifact ? `\n\nSpec:\n${specArtifact.content}` : ""

    const config = {
      role: ROLES.ARCHITECT,
      systemPrompt: this.deps.systemPrompt + specContext,
      tools: [],
      model: this.deps.model,
      budget: task.budget,
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
