import { formatTokens, formatCurrency, formatPercent } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface MetricValueProps {
  label: string
  value: number
  trend?: number
  format?: "number" | "currency" | "tokens" | "percent"
  className?: string
}

function formatValue(value: number, fmt: MetricValueProps["format"]): string {
  switch (fmt) {
    case "currency": return formatCurrency(value)
    case "tokens":   return formatTokens(value)
    case "percent":  return formatPercent(value)
    default:         return value.toLocaleString()
  }
}

export function MetricValue({ label, value, trend, format = "number", className }: MetricValueProps) {
  return (
    <div className={cn("flex flex-col", className)}>
      <span className="text-xs uppercase tracking-wider text-text-secondary">
        {label}
      </span>
      <div className="flex items-baseline gap-2 mt-1">
        <span className="font-mono text-2xl font-bold text-text-primary">
          {formatValue(value, format)}
        </span>
        {trend !== undefined && trend !== 0 && (
          <span className={cn("text-xs", trend > 0 ? "text-status-green-fg" : "text-status-red-fg")}>
            {trend > 0 ? "↑" : "↓"} {Math.abs(trend).toLocaleString()}
          </span>
        )}
      </div>
    </div>
  )
}
