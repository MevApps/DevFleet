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

export interface ProductPluginDeps {
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

export class ProductPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  readonly id: string
  readonly name = "product-agent"
  readonly version = "1.0.0"
  readonly description = "Product agent that writes requirement specs"

  private readonly deps: ProductPluginDeps

  constructor(deps: ProductPluginDeps) {
    this.deps = deps
    this.id = `product-${deps.agentId}`
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

    const config = {
      role: ROLES.PRODUCT,
      systemPrompt: this.deps.systemPrompt,
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

    // Create spec artifact
    if (content) {
      const artifact = createArtifact({
        id: createArtifactId(),
        kind: "spec",
        format: "markdown",
        taskId: task.id,
        createdBy: this.deps.agentId,
        content,
        metadata: {
          requirementCount: (content.match(/^\d+\./gm) || []).length,
          hasSuccessCriteria: content.toLowerCase().includes("success criteria"),
        },
      })
      await this.deps.createArtifact.execute(artifact)
    }

    // Emit task.completed
    await this.deps.bus.emit({
      id: createMessageId(),
      type: "task.completed",
      taskId: message.taskId,
      agentId: this.deps.agentId,
      timestamp: new Date(),
    })
  }
}
