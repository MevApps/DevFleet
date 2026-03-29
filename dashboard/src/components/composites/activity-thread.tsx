// src/components/composites/activity-thread.tsx
import type { EventDTO } from "@/lib/types"
import { StatusDot } from "@/components/primitives/status-dot"
import { formatTimeAgo } from "@/lib/utils/format"

export function eventToStatus(type: string): string {
  if (type.includes("completed") || type.includes("approved") || type.includes("merged")) return "completed"
  if (type.includes("created") || type.includes("assigned")) return "active"
  if (type.includes("failed") || type.includes("rejected") || type.includes("discarded")) return "failed"
  if (type.includes("review")) return "review"
  return "idle"
}

interface ActivityThreadProps {
  events: readonly EventDTO[]
}

export function ActivityThread({ events }: ActivityThreadProps) {
  if (events.length === 0) {
    return <p className="text-[11px] text-text-muted py-3">No activity yet.</p>
  }

  return (
    <div>
      {events.map((event, i) => (
        <div key={event.id} className="flex gap-2.5 py-2 border-b border-border last:border-b-0 text-[12px]">
          <div className="flex flex-col items-center w-4 pt-1 shrink-0">
            <StatusDot status={eventToStatus(event.type)} size="sm" />
            {i < events.length - 1 && <div className="w-px flex-1 bg-border mt-1" />}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-mono font-medium text-text-primary">{event.type}</p>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-text-muted">
              {event.agentId && <span>{event.agentId}</span>}
              {event.taskId && <span>task:{event.taskId.slice(0, 8)}</span>}
              <span className="font-mono">{formatTimeAgo(event.occurredAt)}</span>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
