import { getStatusColor } from "@/lib/registry/statuses"
import { statusClasses } from "@/lib/theme/colors"
import { cn } from "@/lib/utils"

interface StatusDotProps {
  status: string
  size?: "sm" | "md"
  pulse?: boolean
  className?: string
}

const SIZE = { sm: "h-1.5 w-1.5", md: "h-2 w-2" } as const

export function StatusDot({ status, size = "md", pulse = false, className }: StatusDotProps) {
  const color = getStatusColor(status)
  const classes = statusClasses(color)
  return (
    <span
      className={cn("inline-block rounded-full", SIZE[size], classes.bgFg, className)}
      style={pulse ? { boxShadow: `0 0 6px var(--status-${color}-fg)` } : undefined}
    />
  )
}
