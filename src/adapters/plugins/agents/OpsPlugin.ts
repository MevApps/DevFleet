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

export interface OpsPluginDeps {
  readonly agentId: AgentId
  readonly projectId: ProjectId
  readonly executor: AgentExecutor
  readonly taskRepo: TaskRepository
  readonly artifactRepo: ArtifactRepository
  readonly createArtifact: CreateArtifactUseCase
  readonly bus: MessagePort
}

const SHELL_RUN_TOOL = {
  name: "shell_run",
  description: "Run a shell command",
  inputSchema: {
    type: "object" as const,
    properties: { command: { type: "string" } },
    required: ["command"],
  },
}

export class OpsPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  readonly id: string
  readonly name = "ops-agent"
  readonly version = "1.0.0"
  readonly description = "Ops agent that runs builds and tests deterministically"

  private readonly deps: OpsPluginDeps

  constructor(deps: OpsPluginDeps) {
    this.deps = deps
    this.id = `ops-${deps.agentId}`
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
      role: ROLES.OPS,
      systemPrompt: "",
      tools: [SHELL_RUN_TOOL],
      model: "deterministic",
      budget: task.budget,
    }

    let buildOutput = ""
    const startTime = Date.now()
    let buildFailed = false

    for await (const event of this.deps.executor.run(this.deps.agentId, config, task, this.deps.projectId)) {
      if (event.type === "tool_executed" && event.data["success"] === false) {
        buildFailed = true
      }
      if (event.type === "task_completed" && typeof event.data["content"] === "string") {
        buildOutput = event.data["content"] as string
      }
    }

    const durationMs = Date.now() - startTime

    const passedMatch = buildOutput.match(/(\d+)\s+passed/)
    const failedMatch = buildOutput.match(/(\d+)\s+failed/)
    const passed = passedMatch ? parseInt(passedMatch[1]!, 10) : 0
    const failed = failedMatch ? parseInt(failedMatch[1]!, 10) : 0

    const artifact = createArtifact({
      id: createArtifactId(),
      kind: "test_report",
      format: "json",
      taskId: task.id,
      createdBy: this.deps.agentId,
      content: JSON.stringify({ passed, failed, output: buildOutput }),
      metadata: { passed, failed, coverageDelta: 0 },
    })
    await this.deps.createArtifact.execute(artifact)

    if (buildFailed || failed > 0) {
      await this.deps.bus.emit({
        id: createMessageId(),
        type: "build.failed",
        taskId: task.id,
        error: buildOutput,
        timestamp: new Date(),
      })
    } else {
      await this.deps.bus.emit({
        id: createMessageId(),
        type: "build.passed",
        taskId: task.id,
        durationMs,
        timestamp: new Date(),
      })
    }

    await this.deps.bus.emit({
      id: createMessageId(),
      type: "test.report.created",
      taskId: task.id,
      artifactId: artifact.id,
      timestamp: new Date(),
    })

    await this.deps.bus.emit({
      id: createMessageId(),
      type: "task.completed",
      taskId: task.id,
      agentId: this.deps.agentId,
      timestamp: new Date(),
    })
  }
}
