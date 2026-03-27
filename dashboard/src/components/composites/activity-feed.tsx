import type { EventDTO } from "@/lib/types"
import { StatusDot } from "@/components/primitives/status-dot"
import { TimeAgo } from "@/components/primitives/time-ago"
import { EmptyState } from "@/components/primitives/empty-state"

function eventToStatus(type: string): string {
  if (type.includes("completed") || type.includes("approved") || type.includes("merged")) return "completed"
  if (type.includes("created") || type.includes("assigned")) return "active"
  if (type.includes("failed") || type.includes("rejected") || type.includes("discarded")) return "failed"
  if (type.includes("review")) return "review"
  return "idle"
}

export function ActivityFeed({ events, title = "Activity" }: { events: readonly EventDTO[]; title?: string }) {
  return (
    <div className="rounded-lg border border-border p-4 bg-card">
      <h3 className="text-base font-medium mb-3 text-text-primary">{title}</h3>
      <div className="max-h-96 overflow-y-auto">
        {events.length === 0 && (
          <EmptyState icon="Activity" title="No events yet" description="Events will appear as the system processes tasks" />
        )}
        {events.map((event) => (
          <div key={event.id} className="flex gap-3 py-3 border-b last:border-b-0 border-border">
            <div className="flex flex-col items-center gap-1 pt-1">
              <StatusDot status={eventToStatus(event.type)} pulse={false} />
              <div className="w-px flex-1 bg-border" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-mono font-medium truncate text-text-primary">{event.type}</span>
                <TimeAgo timestamp={event.occurredAt} className="shrink-0" />
              </div>
              <div className="flex gap-2 text-xs mt-0.5 text-text-secondary">
                {event.taskId && <span>task:{event.taskId.slice(0, 8)}</span>}
                {event.agentId && <span>{event.agentId}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
