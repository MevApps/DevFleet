"use client"
import { useDashboardStore } from "@/lib/store"
import { useInspectorStore } from "@/lib/inspector-store"
import { StatusDot } from "@/components/primitives/status-dot"
import { eventToStatus } from "@/components/composites/activity-thread"
import { formatTimeAgo } from "@/lib/utils/format"

interface EventInspectorProps {
  entityId: string
}

export function EventInspector({ entityId }: EventInspectorProps) {
  const event = useDashboardStore((s) => s.recentEvents.find((e) => e.id === entityId))
  const openInspector = useInspectorStore((s) => s.open)

  if (!event) {
    return <p className="text-sm text-text-muted">Event not found.</p>
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <StatusDot status={eventToStatus(event.type)} />
        <h2 className="text-[15px] font-bold font-mono text-text-primary">{event.type}</h2>
      </div>

      <div className="space-y-2.5 mb-4">
        <DetailRow label="Timestamp">{formatTimeAgo(event.occurredAt)}</DetailRow>
        {event.goalId && (
          <DetailRow label="Goal">
            <button
              onClick={() => openInspector(event.goalId!, "goal", event.goalId!)}
              className="text-status-blue-fg font-mono hover:underline"
            >
              {event.goalId}
            </button>
          </DetailRow>
        )}
        {event.taskId && (
          <DetailRow label="Task">
            <button
              onClick={() => openInspector(event.taskId!, "task", event.taskId!)}
              className="text-status-blue-fg font-mono hover:underline"
            >
              {event.taskId}
            </button>
          </DetailRow>
        )}
        {event.agentId && (
          <DetailRow label="Agent">
            <button
              onClick={() => openInspector(event.agentId!, "agent", event.agentId!)}
              className="text-status-blue-fg font-mono hover:underline"
            >
              {event.agentId}
            </button>
          </DetailRow>
        )}
      </div>
    </div>
  )
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border text-[12px]">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-primary">{children}</span>
    </div>
  )
}
