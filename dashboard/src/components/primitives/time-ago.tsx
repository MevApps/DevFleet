"use client"
import { useEffect, useState } from "react"
import { formatTimeAgo } from "@/lib/utils/format"
import { cn } from "@/lib/utils"

interface TimeAgoProps {
  timestamp: string
  staleAfter?: number
  showLiveIndicator?: boolean
  className?: string
}

export function TimeAgo({ timestamp, staleAfter, showLiveIndicator = false, className }: TimeAgoProps) {
  const [text, setText] = useState(() => formatTimeAgo(timestamp))

  useEffect(() => {
    const interval = setInterval(() => setText(formatTimeAgo(timestamp)), 5000)
    return () => clearInterval(interval)
  }, [timestamp])

  const elapsed = Date.now() - new Date(timestamp).getTime()
  const isStale = staleAfter !== undefined && elapsed > staleAfter
  const isLive = showLiveIndicator && elapsed < 10_000

  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs text-text-secondary", className)}>
      {text}
      {isLive && (
        <span className="inline-flex items-center gap-1 text-xs text-status-green-fg">
          <span className="h-1 w-1 rounded-full animate-pulse bg-status-green-fg" />
          live
        </span>
      )}
      {isStale && (
        <span className="text-xs text-status-yellow-fg">stale</span>
      )}
    </span>
  )
}
