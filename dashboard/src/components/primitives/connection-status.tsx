import { cn } from "@/lib/utils"

type ConnectionState = "connected" | "reconnecting" | "disconnected"

interface ConnectionStatusProps {
  state: ConnectionState
  className?: string
}

const CONFIG: Record<ConnectionState, { label: string; dotClass: string; pulse: boolean }> = {
  connected:    { label: "Live",           dotClass: "bg-status-green-fg",  pulse: true },
  reconnecting: { label: "Reconnecting...", dotClass: "bg-status-yellow-fg", pulse: false },
  disconnected: { label: "Disconnected",   dotClass: "bg-status-red-fg",   pulse: false },
}

export function ConnectionStatus({ state, className }: ConnectionStatusProps) {
  const { label, dotClass, pulse } = CONFIG[state]
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span
        className={cn("h-1.5 w-1.5 rounded-full", dotClass, pulse && "animate-pulse")}
        style={pulse ? { boxShadow: `0 0 4px var(--status-green-fg)` } : undefined}
      />
      <span className="text-text-secondary">{label}</span>
    </span>
  )
}
