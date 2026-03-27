"use client"
import { useEffect, useState } from "react"
import { api } from "@/lib/api"
import type { QualityData } from "@/lib/types"

export default function QualityPage() {
  const [data, setData] = useState<QualityData | null>(null)
  useEffect(() => { api.quality().then(setData) }, [])
  if (!data) return <div className="text-zinc-400">Loading quality metrics...</div>
  const pct = (data.overallKeepRate * 100).toFixed(1)
  const color = data.overallKeepRate > 0.7 ? "text-green-400" : data.overallKeepRate > 0.5 ? "text-yellow-400" : "text-red-400"
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Quality</h1>
      <div className="grid grid-cols-2 gap-4">
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center"><div className="text-sm text-zinc-400">Overall Keep Rate</div><div className={`text-4xl font-bold mt-2 ${color}`}>{pct}%</div></div>
        <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-6 text-center"><div className="text-sm text-zinc-400">Review Pass Rate</div><div className="text-4xl font-bold mt-2 text-white">{(data.reviewPassRate * 100).toFixed(1)}%</div></div>
      </div>
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4">
        <h2 className="text-lg font-semibold text-white mb-4">Top Rejection Reasons</h2>
        {data.topRejectionReasons.length === 0 ? <div className="text-zinc-500">No rejections yet</div> : (
          <div className="space-y-2">{data.topRejectionReasons.map((r, i) => (
            <div key={i} className="flex justify-between items-center py-1 border-b border-zinc-800 last:border-0"><span className="text-sm text-zinc-300">{r.reason}</span><span className="text-sm font-mono text-zinc-400">{r.count}</span></div>
          ))}</div>
        )}
      </div>
    </div>
  )
}
