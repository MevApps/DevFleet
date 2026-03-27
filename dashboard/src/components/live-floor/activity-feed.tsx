import type { EventDTO } from "@/lib/types"

export function ActivityFeed({ events }: { events: readonly EventDTO[] }) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
      <h3 className="text-sm font-semibold text-white mb-3">Activity Feed</h3>
      <div className="space-y-2 max-h-96 overflow-y-auto">
        {events.length === 0 && <p className="text-xs text-zinc-500">No events yet</p>}
        {events.map((event) => (
          <div key={event.id} className="flex items-start gap-2 text-xs">
            <span className="text-zinc-500 whitespace-nowrap">{new Date(event.occurredAt).toLocaleTimeString()}</span>
            <span className="text-zinc-300 font-mono">{event.type}</span>
            {event.taskId && <span className="text-zinc-500">task:{event.taskId.slice(0, 8)}</span>}
            {event.agentId && <span className="text-zinc-500">{event.agentId}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
