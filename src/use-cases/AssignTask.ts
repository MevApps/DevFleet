import type { TaskId } from "../entities/ids"
import type { AgentRole } from "../entities/AgentRole"
import type { TaskRepository } from "./ports/TaskRepository"
import type { AgentRegistry } from "./ports/AgentRegistry"
import type { MessagePort } from "./ports/MessagePort"
import { success, failure, type Result } from "./Result"
import { createMessageId } from "../entities/ids"

export class AssignTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly registry: AgentRegistry,
    private readonly bus: MessagePort,
  ) {}

  async execute(taskId: TaskId, role: AgentRole): Promise<Result<void>> {
    const task = await this.tasks.findById(taskId)
    if (!task) {
      return failure(`Task ${taskId} not found`)
    }

    if (task.status !== "queued") {
      return failure(`Task ${taskId} is not queued (status: ${task.status})`)
    }

    const agent = await this.registry.findAvailable(role)
    if (!agent) {
      return failure(`No agent available for role ${role}`)
    }

    const updated = {
      ...task,
      status: "in_progress" as const,
      assignedTo: agent.id,
      version: task.version + 1,
    }

    await this.tasks.update(updated)
    await this.registry.updateStatus(agent.id, "busy", taskId)

    await this.bus.emit({
      id: createMessageId(),
      type: "task.assigned",
      taskId,
      agentId: agent.id,
      timestamp: new Date(),
    })

    return success(undefined)
  }
}
