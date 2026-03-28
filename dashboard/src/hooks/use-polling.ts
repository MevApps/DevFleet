"use client"
import { useEffect } from "react"

export function usePolling(fetchFn: () => Promise<void>, intervalMs: number = 10_000) {
  useEffect(() => {
    const safeFetch = () => fetchFn().catch(() => { /* endpoint may not exist yet */ })
    safeFetch()
    const interval = setInterval(safeFetch, intervalMs)
    return () => clearInterval(interval)
  }, [fetchFn, intervalMs])
}
