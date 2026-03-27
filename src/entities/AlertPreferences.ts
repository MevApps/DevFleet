import type { MessageType } from "./Message"

export interface AlertPreferences {
  readonly minSeverity: "info" | "warning" | "urgent"
  readonly mutedTriggers: ReadonlyArray<MessageType>
}

export function createDefaultAlertPreferences(): AlertPreferences {
  return { minSeverity: "info", mutedTriggers: [] }
}

const SEVERITY_RANK: Record<string, number> = { info: 0, warning: 1, urgent: 2 }

export function severityRank(severity: "info" | "warning" | "urgent"): number {
  return SEVERITY_RANK[severity] ?? 0
}
