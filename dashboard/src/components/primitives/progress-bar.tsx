import { cn } from "@/lib/utils"

interface ProgressBarProps {
  value: number
  label?: string
  showPercent?: boolean
  thresholds?: { warn: number; critical: number }
  className?: string
}

function getBarColorClass(value: number, thresholds?: { warn: number; critical: number }): string {
  if (!thresholds) return "bg-status-blue-fg"
  if (value >= thresholds.critical) return "bg-status-red-fg"
  if (value >= thresholds.warn) return "bg-status-yellow-fg"
  return "bg-status-green-fg"
}

function getBarTextClass(value: number, thresholds?: { warn: number; critical: number }): string {
  if (!thresholds) return "text-status-blue-fg"
  if (value >= thresholds.critical) return "text-status-red-fg"
  if (value >= thresholds.warn) return "text-status-yellow-fg"
  return "text-status-green-fg"
}

export function ProgressBar({ value, label, showPercent = false, thresholds, className }: ProgressBarProps) {
  const pct = Math.round(Math.min(value, 1) * 100)
  const bgClass = getBarColorClass(value, thresholds)
  const textClass = getBarTextClass(value, thresholds)

  return (
    <div className={cn("w-full", className)}>
      {(label || showPercent) && (
        <div className="flex justify-between mb-1">
          {label && <span className="text-xs text-text-secondary">{label}</span>}
          {showPercent && <span className={cn("text-xs font-mono", textClass)}>{pct}%</span>}
        </div>
      )}
      <div className="h-1.5 rounded-full overflow-hidden bg-hover">
        <div
          className={cn("h-full rounded-full transition-[width] duration-300 ease-out", bgClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}
