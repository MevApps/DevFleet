"use client"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { QualityData } from "@/lib/types"

export default function QualityPage() {
  const [data, setData] = useState<QualityData | null>(null)
  useEffect(() => { api.quality().then(setData) }, [])
  if (!data) return <div className="text-text-secondary">Loading quality metrics...</div>
  const pct = (data.overallKeepRate * 100).toFixed(1)
  const color = data.overallKeepRate > 0.7 ? "text-status-green-fg" : data.overallKeepRate > 0.5 ? "text-status-yellow-fg" : "text-status-red-fg"
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-text-primary">Quality</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-border bg-card p-6 text-center"><div className="text-sm text-text-secondary">Overall Keep Rate</div><div className={`text-4xl font-bold mt-2 ${color}`}>{pct}%</div></div>
        <div className="rounded-lg border border-border bg-card p-6 text-center"><div className="text-sm text-text-secondary">Review Pass Rate</div><div className="text-4xl font-bold mt-2 text-text-primary">{(data.reviewPassRate * 100).toFixed(1)}%</div></div>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Top Rejection Reasons</h2>
        {data.topRejectionReasons.length === 0 ? <div className="text-text-muted">No rejections yet</div> : (
          <div className="space-y-2">{data.topRejectionReasons.map((r, i) => (
            <div key={i} className="flex justify-between items-center py-1 border-b border-border last:border-0"><span className="text-sm text-text-primary">{r.reason}</span><span className="text-sm font-mono text-text-secondary">{r.count}</span></div>
          ))}</div>
        )}
      </div>
    </div>
  )
}
