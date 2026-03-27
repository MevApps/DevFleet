import type { GoalId, TaskId, InsightId } from "../../entities/ids"

export interface CeoAlert {
  readonly severity: "info" | "warning" | "urgent"
  readonly title: string
  readonly body: string
  readonly goalId?: GoalId
  readonly taskId?: TaskId
  readonly insightId?: InsightId
}

export interface NotificationPort {
  notify(alert: CeoAlert): Promise<void>
}
