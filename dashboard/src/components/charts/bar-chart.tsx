"use client"
import { BarChart as RechartsBar, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts"

interface DFBarChartProps {
  data: Array<Record<string, unknown>>
  dataKey: string
  nameKey?: string
  color?: string
  height?: number
  layout?: "horizontal" | "vertical"
}

export function DFBarChart({ data, dataKey, nameKey = "name", color = "var(--status-blue-fg)", height = 200, layout = "vertical" }: DFBarChartProps) {
  if (layout === "horizontal") {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <RechartsBar data={data} layout="vertical">
          <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-hover)" horizontal={false} />
          <XAxis type="number" tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
          <YAxis dataKey={nameKey} type="category" tick={{ fill: "var(--text-secondary)", fontSize: 11 }} axisLine={false} tickLine={false} width={80} />
          <Tooltip contentStyle={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)", borderRadius: "var(--radius-md)", fontSize: 12 }} labelStyle={{ color: "var(--text-primary)" }} />
          <Bar dataKey={dataKey} fill={color} radius={[0, 4, 4, 0]} animationDuration={300} />
        </RechartsBar>
      </ResponsiveContainer>
    )
  }
  return (
    <ResponsiveContainer width="100%" height={height}>
      <RechartsBar data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--bg-hover)" vertical={false} />
        <XAxis dataKey={nameKey} tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={{ stroke: "var(--border)" }} tickLine={false} />
        <YAxis tick={{ fill: "var(--text-muted)", fontSize: 10 }} axisLine={false} tickLine={false} />
        <Tooltip contentStyle={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)", borderRadius: "var(--radius-md)", fontSize: 12 }} labelStyle={{ color: "var(--text-primary)" }} />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} animationDuration={300} />
      </RechartsBar>
    </ResponsiveContainer>
  )
}
