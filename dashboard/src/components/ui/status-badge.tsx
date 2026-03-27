const STATUS_COLORS: Record<string, string> = {
  idle: "bg-zinc-700 text-zinc-300", busy: "bg-blue-900 text-blue-300", blocked: "bg-yellow-900 text-yellow-300",
  paused: "bg-orange-900 text-orange-300", stopped: "bg-red-900 text-red-300", queued: "bg-zinc-700 text-zinc-300",
  in_progress: "bg-blue-900 text-blue-300", review: "bg-purple-900 text-purple-300", approved: "bg-green-900 text-green-300",
  merged: "bg-green-900 text-green-300", discarded: "bg-red-900 text-red-300", active: "bg-blue-900 text-blue-300",
  completed: "bg-green-900 text-green-300", abandoned: "bg-red-900 text-red-300", proposed: "bg-zinc-700 text-zinc-300",
}

export function StatusBadge({ status }: { status: string }) {
  const colors = STATUS_COLORS[status] ?? "bg-zinc-700 text-zinc-300"
  return <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>{status.replace("_", " ")}</span>
}
