import type { AgentId, ProjectId } from "../../../entities/ids"
import { createMessageId, createArtifactId } from "../../../entities/ids"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../../use-cases/ports/PluginInterfaces"
import type { AgentExecutor } from "../../../use-cases/ports/AgentExecutor"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import type { ToolDefinition } from "../../../use-cases/ports/AIProvider"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import type { WorktreeManager } from "../../../use-cases/ports/WorktreeManager"
import type { ScopedExecutorFactory } from "../../../use-cases/ports/ScopedExecutorFactory"
import { ROLES } from "../../../entities/AgentRole"

export interface DeveloperPluginDeps {
  readonly agentId: AgentId
  readonly projectId: ProjectId
  readonly executor: AgentExecutor
  readonly taskRepo: TaskRepository
  readonly systemPrompt: string
  readonly model: string
  readonly bus: MessagePort
  readonly worktreeManager: WorktreeManager
  readonly scopedExecutorFactory: ScopedExecutorFactory
}

export const DEVELOPER_TOOLS: ToolDefinition[] = [
  {
    name: "file_read",
    description: "Read the contents of a file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file to read" },
      },
      required: ["path"],
    },
  },
  {
    name: "file_write",
    description: "Write content to a file (creates or overwrites)",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to write to" },
        content: { type: "string", description: "Content to write" },
      },
      required: ["path", "content"],
    },
  },
  {
    name: "file_edit",
    description: "Replace a substring in a file",
    inputSchema: {
      type: "object",
      properties: {
        path: { type: "string", description: "Path to the file to edit" },
        oldContent: { type: "string", description: "Content to replace" },
        newContent: { type: "string", description: "Replacement content" },
      },
      required: ["path", "oldContent", "newContent"],
    },
  },
  {
    name: "file_glob",
    description: "List files matching a glob pattern",
    inputSchema: {
      type: "object",
      properties: {
        pattern: { type: "string", description: "Glob pattern" },
      },
      required: ["pattern"],
    },
  },
  {
    name: "shell_run",
    description: "Run a shell command",
    inputSchema: {
      type: "object",
      properties: {
        command: { type: "string", description: "Shell command to execute" },
        timeout: { type: "number", description: "Timeout in milliseconds" },
      },
      required: ["command"],
    },
  },
]

export class DeveloperPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  // PluginIdentity
  readonly id: string
  readonly name = "developer-agent"
  readonly version = "1.0.0"
  readonly description = "Developer agent that implements coding tasks"

  private readonly deps: DeveloperPluginDeps

  constructor(deps: DeveloperPluginDeps) {
    this.deps = deps
    this.id = `developer-${deps.agentId}`
  }

  // Lifecycle
  async start(): Promise<void> {
    // No-op — subscriptions are handled externally via PluginRegistry
  }

  async stop(): Promise<void> {
    // No-op
  }

  async healthCheck(): Promise<HealthStatus> {
    return "healthy"
  }

  // PluginMessageHandler
  subscriptions(): ReadonlyArray<MessageFilter> {
    return [{ types: ["task.assigned"] }]
  }

  async handle(message: Message): Promise<void> {
    if (message.type !== "task.assigned") return

    // Only handle messages assigned to this agent
    if (message.agentId !== this.deps.agentId) return

    const task = await this.deps.taskRepo.findById(message.taskId)
    if (!task) return

    // Always create worktree isolation
    const branchName = `devfleet/task-${task.id}`
    const worktreePath = await this.deps.worktreeManager.create(branchName)
    const updatedTask = { ...task, branch: branchName, version: task.version + 1 }
    await this.deps.taskRepo.update(updatedTask)

    // Always use scoped executor
    const executor = this.deps.scopedExecutorFactory(worktreePath)

    const config = {
      role: ROLES.DEVELOPER,
      systemPrompt: this.deps.systemPrompt,
      tools: DEVELOPER_TOOLS,
      model: this.deps.model,
      budget: task.budget,
    }

    for await (const event of executor.run(this.deps.agentId, config, task, this.deps.projectId)) {
      if (event.type === "task_completed") {
        await this.deps.bus.emit({
          id: createMessageId(),
          type: "code.completed",
          taskId: message.taskId,
          artifactId: createArtifactId(),
          branch: branchName,
          filesChanged: 0,
          testsWritten: 0,
          timestamp: new Date(),
        })
      }
    }
  }
}
