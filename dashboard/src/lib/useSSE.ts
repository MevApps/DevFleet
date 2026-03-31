"use client"
import { useEffect, useRef } from "react"
import { useDashboardStore } from "./store"
import { useUIStore } from "./ui-store"
import { SSE_URL } from "./api"
import type { SSEEvent } from "./types"

const DASHBOARD_REFRESH_TYPES = new Set([
  "goal.created", "goal.completed", "goal.abandoned",
  "task.created", "task.assigned", "task.completed", "task.failed",
  "review.approved", "review.rejected",
  "branch.merged", "branch.discarded",
])

export function useSSE() {
  const handleSSEEvent = useDashboardStore((s) => s.handleSSEEvent)
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  const fetchPipeline = useDashboardStore((s) => s.fetchPipeline)
  const fetchMetrics = useDashboardStore((s) => s.fetchMetrics)
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    useUIStore.getState().setConnectionState("reconnecting")
    const source = new EventSource(SSE_URL)
    sourceRef.current = source

    source.onopen = () => {
      useUIStore.getState().setConnectionState("connected")
    }

    source.onmessage = (event) => {
      const data = JSON.parse(event.data) as SSEEvent
      handleSSEEvent(data)
      if (DASHBOARD_REFRESH_TYPES.has(data.type)) {
        void fetchLiveFloor()
        void fetchPipeline()
        void fetchMetrics()
      }
    }

    source.onerror = () => {
      useUIStore.getState().setConnectionState("reconnecting")
    }

    return () => {
      source.close()
      sourceRef.current = null
    }
  }, [handleSSEEvent, fetchLiveFloor, fetchPipeline, fetchMetrics])
}
