import type { Metric } from "../../entities/Metric"
import type { TaskId, AgentId } from "../../entities/ids"
import type { MetricRecorder } from "../../use-cases/ports/MetricRecorder"

export class InMemoryMetricRecorder implements MetricRecorder {
  private readonly metrics: Metric[] = []

  async record(metric: Metric): Promise<void> {
    this.metrics.push(metric)
  }

  async findByTaskId(taskId: TaskId): Promise<ReadonlyArray<Metric>> {
    return this.metrics.filter(m => m.taskId === taskId)
  }

  async findByAgentId(agentId: AgentId): Promise<ReadonlyArray<Metric>> {
    return this.metrics.filter(m => m.agentId === agentId)
  }
}
