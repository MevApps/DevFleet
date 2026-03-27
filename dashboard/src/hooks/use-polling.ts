"use client"
import { useEffect } from "react"

export function usePolling(fetchFn: () => Promise<void>, intervalMs: number = 10_000) {
  useEffect(() => {
    fetchFn()
    const interval = setInterval(() => void fetchFn(), intervalMs)
    return () => clearInterval(interval)
  }, [fetchFn, intervalMs])
}
