"use client"
import { useDashboardStore } from "@/lib/store"
import { usePolling } from "@/hooks/use-polling"
import { ActivityFeed } from "@/components/composites/activity-feed"

export default function EventsPage() {
  const { recentEvents } = useDashboardStore()
  const fetchLiveFloor = useDashboardStore((s) => s.fetchLiveFloor)
  usePolling(fetchLiveFloor)

  return <ActivityFeed events={recentEvents} title="All Events" />
}
