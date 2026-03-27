"use client"
import { AreaChart as RechartsArea, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

interface DFAreaChartProps {
  data: Array<Record<string, unknown>>
  dataKey: string
  xKey?: string
  color?: string
  height?: number
  showGrid?: boolean
}

export function DFAreaChart({ data, dataKey, xKey = "time", color = "var(--status-blue-fg)", height = 200, showGrid = false }: DFAreaChartProps) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsArea data={data}>
        {showGrid && <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-hover)" />}
        <XAxis dataKey={xKey} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip
          contentStyle={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)", borderRadius: "var(--radius-md)", fontSize: 12 }}
          labelStyle={{ color: "var(--text-primary)" }}
          itemStyle={{ color: "var(--text-secondary)" }}
        />
        <defs>
          <linearGradient id={`gradient-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2} fill={`url(#gradient-${dataKey})`} animationDuration={300} />
      </RechartsArea>
    </ResponsiveContainer>
  )
}
