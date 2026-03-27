import { getStatusColor } from "@/lib/registry/statuses"
import { statusClasses } from "@/lib/theme/colors"
import { cn } from "@/lib/utils"

interface StatusBadgeProps {
  status: string
  variant?: "pill" | "dot-label"
  className?: string
}

export function StatusBadge({ status, variant = "pill", className }: StatusBadgeProps) {
  const color = getStatusColor(status)
  const classes = statusClasses(color)
  const label = status.replace(/_/g, " ")

  if (variant === "dot-label") {
    return (
      <span className={cn("inline-flex items-center gap-1.5", className)}>
        <span className={cn("h-1.5 w-1.5 rounded-full", classes.bgFg)} />
        <span className={cn("text-xs", classes.fg)}>{label}</span>
      </span>
    )
  }

  return (
    <span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium border", classes.surface, classes.border, classes.fg, className)}>
      {label}
    </span>
  )
}
