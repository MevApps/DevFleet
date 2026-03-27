"use client"
import { useEffect, useState } from "react"
import { useDashboardStore } from "@/lib/store"

const SEVERITY_COLORS = { info: "border-blue-500", warning: "border-yellow-500", urgent: "border-red-500" }

export function AlertsDrawer() {
  const [open, setOpen] = useState(false)
  const { alerts, unreadAlertCount, fetchAlerts } = useDashboardStore()
  useEffect(() => { fetchAlerts() }, [])
  const toggle = () => { setOpen(!open); if (!open) useDashboardStore.setState({ unreadAlertCount: 0 }) }
  return (
    <>
      <button onClick={toggle} className="relative p-2 text-zinc-400 hover:text-white">
        <span className="text-lg">&#128276;</span>
        {unreadAlertCount > 0 && <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center">{unreadAlertCount}</span>}
      </button>
      {open && (
        <div className="fixed right-0 top-0 h-full w-80 bg-zinc-950 border-l border-zinc-800 z-50 overflow-y-auto p-4">
          <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-white">Alerts</h2><button onClick={toggle} className="text-zinc-400 hover:text-white text-xl">&times;</button></div>
          {alerts.length === 0 ? <div className="text-zinc-500 text-sm">No alerts</div> : (
            <div className="space-y-2">{alerts.map((a, i) => (
              <div key={i} className={`rounded border-l-2 ${SEVERITY_COLORS[a.severity]} bg-zinc-900 p-3`}>
                <div className="text-sm font-medium text-white">{a.title}</div>
                <div className="text-xs text-zinc-400 mt-1">{a.body}</div>
                <div className="text-xs text-zinc-500 mt-1">{new Date(a.timestamp).toLocaleTimeString()}</div>
              </div>
            ))}</div>
          )}
        </div>
      )}
    </>
  )
}
