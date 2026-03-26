import type { TaskId } from "../entities/ids"
import type { MetricRecorder } from "./ports/MetricRecorder"
import type { TaskRepository } from "./ports/TaskRepository"
import { success, failure, type Result } from "./Result"

export interface TurnMetricsInput {
  readonly tokensIn: number
  readonly tokensOut: number
  readonly durationMs: number
}

export class RecordTurnMetrics {
  constructor(
    private readonly recorder: MetricRecorder,
    private readonly tasks: TaskRepository,
  ) {}

  async execute(taskId: TaskId, input: TurnMetricsInput): Promise<Result<void>> {
    const task = await this.tasks.findById(taskId)
    if (!task) {
      return failure(`Task ${taskId} not found`)
    }

    const now = new Date()
    const agentId = task.assignedTo

    await this.recorder.record({
      name: "tokens_in",
      value: input.tokensIn,
      unit: "tokens",
      agentId,
      taskId,
      goalId: task.goalId,
      recordedAt: now,
      tags: {},
    })

    await this.recorder.record({
      name: "tokens_out",
      value: input.tokensOut,
      unit: "tokens",
      agentId,
      taskId,
      goalId: task.goalId,
      recordedAt: now,
      tags: {},
    })

    await this.recorder.record({
      name: "turn_duration_ms",
      value: input.durationMs,
      unit: "ms",
      agentId,
      taskId,
      goalId: task.goalId,
      recordedAt: now,
      tags: {},
    })

    const updatedTask = {
      ...task,
      tokensUsed: task.tokensUsed + input.tokensIn + input.tokensOut,
    }
    await this.tasks.update(updatedTask)

    return success(undefined)
  }
}
