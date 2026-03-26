import type { AgentId, GoalId, TaskId } from "../../../entities/ids"
import { createEventId } from "../../../entities/ids"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../../use-cases/ports/PluginInterfaces"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import type { EventStore } from "../../../use-cases/ports/EventStore"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import { type KeepDiscardRecord, createKeepDiscardRecord } from "../../../entities/KeepDiscardRecord"

export interface LearnerPluginDeps {
  readonly agentId: AgentId
  readonly bus: MessagePort
  readonly eventStore: EventStore
  readonly taskRepo: TaskRepository
}

export class LearnerPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  readonly id: string
  readonly name = "learner-agent"
  readonly version = "1.0.0"
  readonly description = "Learner agent that records structured events for future analysis"

  private readonly deps: LearnerPluginDeps
  readonly keepDiscardRecords: KeepDiscardRecord[] = []

  constructor(deps: LearnerPluginDeps) {
    this.deps = deps
    this.id = `learner-${deps.agentId}`
  }

  async start(): Promise<void> {}
  async stop(): Promise<void> {}
  async healthCheck(): Promise<HealthStatus> { return "healthy" }

  subscriptions(): ReadonlyArray<MessageFilter> {
    return [{
      types: [
        "review.approved",
        "review.rejected",
        "goal.completed",
        "budget.exceeded",
        "insight.generated",
        "ceo.override",
      ],
    }]
  }

  async handle(message: Message): Promise<void> {
    switch (message.type) {
      case "review.approved":
        return this.handleReviewVerdict(message.taskId, "approved", [])
      case "review.rejected":
        return this.handleReviewVerdict(message.taskId, "rejected", [...message.reasons])
      default:
        return this.recordSystemEvent(message)
    }
  }

  private async handleReviewVerdict(
    taskId: TaskId,
    verdict: "approved" | "rejected",
    reasons: string[],
  ): Promise<void> {
    const task = await this.deps.taskRepo.findById(taskId)
    if (!task) return

    const record = createKeepDiscardRecord({
      taskId: task.id,
      agentId: task.assignedTo ?? this.deps.agentId,
      phase: task.phase,
      durationMs: 0,
      tokensUsed: task.tokensUsed,
      verdict,
      reasons,
      artifactIds: [...task.artifacts],
      commitHash: null,
    })

    this.keepDiscardRecords.push(record)
  }

  private async recordSystemEvent(message: Message): Promise<void> {
    const goalId = "goalId" in message ? (message as { goalId: unknown }).goalId as GoalId : null
    const taskId = "taskId" in message ? (message as { taskId: unknown }).taskId as TaskId : null
    const agentId = "agentId" in message ? (message as { agentId: unknown }).agentId as AgentId : null

    await this.deps.eventStore.append({
      id: createEventId(),
      type: message.type,
      agentId,
      taskId,
      goalId,
      cost: null,
      occurredAt: new Date(),
      payload: message,
    })
  }
}
