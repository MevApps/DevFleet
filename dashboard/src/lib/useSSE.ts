"use client"
import { useEffect, useRef } from "react"
import { useDashboardStore } from "./store"
import type { SSEEvent } from "./types"

export function useSSE() {
  const handleSSEEvent = useDashboardStore((s) => s.handleSSEEvent)
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  const fetchPipeline = useDashboardStore((s) => s.fetchPipeline)
  const fetchMetrics = useDashboardStore((s) => s.fetchMetrics)
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    const source = new EventSource("/api/events/stream")
    sourceRef.current = source
    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as SSEEvent
      handleSSEEvent(data)
      const refreshTypes = new Set(["goal.created", "goal.completed", "goal.abandoned", "task.created", "task.assigned", "task.completed", "task.failed", "review.approved", "review.rejected", "branch.merged", "branch.discarded"])
      if (refreshTypes.has(data.type)) { void fetchLiveFloor(); void fetchPipeline(); void fetchMetrics() }
    }
    source.onerror = () => {} // EventSource auto-reconnects
    return () => { source.close(); sourceRef.current = null }
  }, [handleSSEEvent, fetchLiveFloor, fetchPipeline, fetchMetrics])
}
