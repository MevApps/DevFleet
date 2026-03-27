import type { AgentId, TaskId } from "../../../entities/ids"
import type { Message, MessageFilter } from "../../../entities/Message"
import type { PluginIdentity, Lifecycle, PluginMessageHandler, HealthStatus } from "../../../use-cases/ports/PluginInterfaces"
import type { MessagePort } from "../../../use-cases/ports/MessagePort"
import type { TaskRepository } from "../../../use-cases/ports/TaskRepository"
import type { KeepDiscardRepository } from "../../../use-cases/ports/KeepDiscardRepository"
import { createKeepDiscardRecord } from "../../../entities/KeepDiscardRecord"

export interface LearnerPluginDeps {
  readonly agentId: AgentId
  readonly bus: MessagePort
  readonly taskRepo: TaskRepository
  readonly keepDiscardRepo: KeepDiscardRepository
  readonly onGoalCompleted?: () => Promise<void>
}

export class LearnerPlugin implements PluginIdentity, Lifecycle, PluginMessageHandler {
  readonly id: string
  readonly name = "learner-agent"
  readonly version = "1.0.0"
  readonly description = "Learner agent that records verdicts and triggers analysis"

  private readonly deps: LearnerPluginDeps

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
      ],
    }]
  }

  async handle(message: Message): Promise<void> {
    switch (message.type) {
      case "review.approved":
        return this.handleReviewVerdict(message.taskId, "approved", [])
      case "review.rejected":
        return this.handleReviewVerdict(message.taskId, "rejected", [...message.reasons])
      case "goal.completed":
        if (this.deps.onGoalCompleted) await this.deps.onGoalCompleted()
        return
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
      goalId: task.goalId,
      agentId: task.assignedTo ?? this.deps.agentId,
      phase: task.phase,
      durationMs: 0,
      tokensUsed: task.tokensUsed,
      costUsd: 0,
      verdict,
      reasons,
      artifactIds: [...task.artifacts],
      commitHash: null,
      iteration: task.retryCount + 1,
    })

    await this.deps.keepDiscardRepo.save(record)
  }
}
