import type { AgentId, ProjectId } from "../../../entities/ids"
import { createMessageId, createArtifactId } from "../../../entities/ids"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../../use-cases/ports/PluginInterfaces"
import type { AgentExecutor } from "../../../use-cases/ports/AgentExecutor"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import type { ArtifactRepository } from "../../../use-cases/ports/ArtifactRepository"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import type { CreateArtifactUseCase } from "../../../use-cases/CreateArtifact"
import type { ToolDefinition } from "../../../use-cases/ports/AIProvider"
import { createArtifact } from "../../../entities/Artifact"
import { ROLES } from "../../../entities/AgentRole"

export interface ReviewerPluginDeps {
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

const REVIEWER_TOOLS: ToolDefinition[] = [
  {
    name: "file_read",
    description: "Read a file",
    inputSchema: { type: "object", properties: { path: { type: "string" } }, required: ["path"] },
  },
  {
    name: "file_glob",
    description: "List files matching a pattern",
    inputSchema: { type: "object", properties: { pattern: { type: "string" } }, required: ["pattern"] },
  },
  {
    name: "shell_run",
    description: "Run a shell command",
    inputSchema: { type: "object", properties: { command: { type: "string" } }, required: ["command"] },
  },
]

export class ReviewerPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  readonly id: string
  readonly name = "reviewer-agent"
  readonly version = "1.0.0"
  readonly description = "Reviewer agent that evaluates code against specs and plans"

  private readonly deps: ReviewerPluginDeps

  constructor(deps: ReviewerPluginDeps) {
    this.deps = deps
    this.id = `reviewer-${deps.agentId}`
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

    const artifacts = await this.deps.artifactRepo.findByTaskId(task.id)
    const artifactContext = artifacts.map(a => `[${a.kind}]:\n${a.content}`).join("\n\n---\n\n")

    const config = {
      role: ROLES.REVIEWER,
      systemPrompt: this.deps.systemPrompt + (artifactContext ? `\n\nArtifacts for review:\n${artifactContext}` : ""),
      tools: REVIEWER_TOOLS,
      model: this.deps.model,
      budget: task.budget,
    }

    let content = ""
    for await (const event of this.deps.executor.run(this.deps.agentId, config, task, this.deps.projectId)) {
      if (event.type === "task_completed" && typeof event.data["content"] === "string") {
        content = event.data["content"] as string
      }
    }

    const approved = content.toUpperCase().includes("APPROVED")
    const reasons = approved
      ? []
      : content.split("\n").filter(l => l.trim().length > 0 && !l.toUpperCase().includes("REJECTED"))

    const artifact = createArtifact({
      id: createArtifactId(),
      kind: "review",
      format: "markdown",
      taskId: task.id,
      createdBy: this.deps.agentId,
      content,
      metadata: { verdict: approved ? "approved" : "rejected", issueCount: reasons.length },
    })
    await this.deps.createArtifact.execute(artifact)

    if (approved) {
      await this.deps.bus.emit({
        id: createMessageId(),
        type: "review.approved",
        taskId: message.taskId,
        reviewerId: this.deps.agentId,
        timestamp: new Date(),
      })
    } else {
      await this.deps.bus.emit({
        id: createMessageId(),
        type: "review.rejected",
        taskId: message.taskId,
        reviewerId: this.deps.agentId,
        reasons,
        timestamp: new Date(),
      })
    }
  }
}
