import type { Metric } from "../../entities/Metric"
import type { TaskId, AgentId } from "../../entities/ids"

export interface MetricRecorder {
  record(metric: Metric): Promise<void>
  findByTaskId(taskId: TaskId): Promise<ReadonlyArray<Metric>>
  findByAgentId(agentId: AgentId): Promise<ReadonlyArray<Metric>>
  findAll(): Promise<ReadonlyArray<Metric>>
}
