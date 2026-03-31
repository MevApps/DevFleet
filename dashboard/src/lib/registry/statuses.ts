export type StatusColor = "green" | "blue" | "purple" | "yellow" | "orange" | "red" | "zinc"

interface StatusGroup {
  readonly color: StatusColor
  readonly statuses: readonly string[]
}

const statusGroups: readonly StatusGroup[] = [
  { color: "green",  statuses: ["completed", "approved", "merged", "healthy", "delivered"] },
  { color: "blue",   statuses: ["active", "busy", "in_progress"] },
  { color: "purple", statuses: ["review", "pending_review"] },
  { color: "yellow", statuses: ["blocked", "warning", "degraded"] },
  { color: "orange", statuses: ["paused", "queued"] },
  { color: "red",    statuses: ["stopped", "abandoned", "discarded", "failed", "unhealthy"] },
  { color: "zinc",   statuses: ["idle", "proposed", "unknown"] },
]

const statusColorMap = new Map<string, StatusColor>()
for (const group of statusGroups) {
  for (const status of group.statuses) {
    statusColorMap.set(status, group.color)
  }
}

export function getStatusColor(status: string): StatusColor {
  return statusColorMap.get(status) ?? "zinc"
}
