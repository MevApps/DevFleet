import { cn } from "@/lib/utils"

interface ProgressRingProps {
  value: number
  size?: "sm" | "md" | "lg"
  thresholds?: { warn: number; critical: number }
  className?: string
}

const SIZES = {
  sm: { px: 32, stroke: 3, radius: 12, fontSize: "9px" },
  md: { px: 48, stroke: 4, radius: 18, fontSize: "11px" },
  lg: { px: 64, stroke: 5, radius: 25, fontSize: "14px" },
} as const

function getRingColor(value: number, thresholds?: { warn: number; critical: number }): string {
  if (!thresholds) return "var(--status-blue-fg)"
  if (value >= thresholds.critical) return "var(--status-red-fg)"
  if (value >= thresholds.warn) return "var(--status-yellow-fg)"
  return "var(--status-green-fg)"
}

export function ProgressRing({ value, size = "md", thresholds, className }: ProgressRingProps) {
  const s = SIZES[size]
  const circumference = 2 * Math.PI * s.radius
  const offset = circumference * (1 - Math.min(value, 1))
  const color = getRingColor(value, thresholds)
  const pct = Math.round(Math.min(value, 1) * 100)

  return (
    <div className={cn("relative", className)} style={{ width: s.px, height: s.px }}>
      <svg width={s.px} height={s.px} viewBox={`0 0 ${s.px} ${s.px}`}>
        <circle cx={s.px / 2} cy={s.px / 2} r={s.radius} fill="none" strokeWidth={s.stroke} stroke="var(--bg-hover)" />
        <circle cx={s.px / 2} cy={s.px / 2} r={s.radius} fill="none" strokeWidth={s.stroke}
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          transform={`rotate(-90 ${s.px / 2} ${s.px / 2})`}
          className="transition-[stroke-dashoffset] duration-500 ease-out" stroke={color} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-mono font-semibold text-text-primary" style={{ fontSize: s.fontSize }}>
        {pct}%
      </div>
    </div>
  )
}
