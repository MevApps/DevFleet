"use client"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts"

interface DonutSegment { name: string; value: number; color: string }

interface DFDonutChartProps {
  data: DonutSegment[]
  centerLabel?: string
  centerValue?: string
  size?: number
}

export function DFDonutChart({ data, centerLabel, centerValue, size = 160 }: DFDonutChartProps) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={size * 0.32} outerRadius={size * 0.45} paddingAngle={2} dataKey="value" animationDuration={300}>
            {data.map((entry, i) => (<Cell key={i} fill={entry.color} stroke="none" />))}
          </Pie>
          <Tooltip contentStyle={{ backgroundColor: "var(--bg-card)", borderColor: "var(--border)", borderRadius: "var(--radius-md)", fontSize: 12 }} />
        </PieChart>
      </ResponsiveContainer>
      {centerValue && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="font-mono text-lg font-bold text-text-primary">{centerValue}</span>
          {centerLabel && <span className="text-xs text-text-secondary">{centerLabel}</span>}
        </div>
      )}
    </div>
  )
}
