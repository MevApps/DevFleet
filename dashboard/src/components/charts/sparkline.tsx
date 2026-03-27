"use client"
import { useId } from "react"
import { AreaChart, Area, ResponsiveContainer } from "recharts"

interface SparklineProps { data: number[]; color?: string; height?: number; width?: number }

export function Sparkline({ data, color = "var(--status-blue-fg)", height = 24, width = 80 }: SparklineProps) {
  const id = useId()
  const gradientId = `sparkGrad-${id}`
  const chartData = data.map((value, i) => ({ i, value }))
  return (
    <ResponsiveContainer width={width} height={height}>
      <AreaChart data={chartData}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey="value" stroke={color} strokeWidth={1.5} fill={`url(#${gradientId})`} dot={false} animationDuration={0} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
