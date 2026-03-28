"use client"
import { useState } from "react"
import { api } from "@/lib/api"
import { useWorkspaceStore } from "@/lib/workspace-store"

const STORAGE_KEY = "devfleet-workspace-last-config"

interface WorkspaceSetupFormProps {
  errorMessage?: string | null
}

export function WorkspaceSetupForm({ errorMessage }: WorkspaceSetupFormProps) {
  const [repoUrl, setRepoUrl] = useState("")
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [maxCostUsd, setMaxCostUsd] = useState(10)
  const [maxTokens, setMaxTokens] = useState(200_000)
  const [timeoutMs, setTimeoutMs] = useState(600_000)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadLastConfig = () => {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (!saved) return
    try {
      const config = JSON.parse(saved) as { repoUrl: string; maxCostUsd: number; maxTokens: number; timeoutMs: number }
      setRepoUrl(config.repoUrl)
      setMaxCostUsd(config.maxCostUsd)
      setMaxTokens(config.maxTokens)
      setTimeoutMs(config.timeoutMs)
    } catch { /* ignore corrupt data */ }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = repoUrl.trim()
    if (!trimmed) { setError("Repository URL is required"); return }
    setSubmitting(true)
    setError(null)
    const config = { repoUrl: trimmed, maxCostUsd, maxTokens, timeoutMs }
    try {
      await api.workspaceStart(config)
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
      const status = await api.workspaceStatus()
      useWorkspaceStore.getState().setStatus(status)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start workspace")
    } finally {
      setSubmitting(false)
    }
  }

  const displayError = error ?? errorMessage

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <form onSubmit={handleSubmit} className="w-full max-w-md">
        <div className="text-center mb-6">
          <p className="text-3xl mb-2">📦</p>
          <h2 className="text-lg font-semibold text-text-primary">Start a Workspace</h2>
          <p className="text-sm text-text-secondary mt-1">
            Clone a repository and let DevFleet work on it.
          </p>
        </div>

        {displayError && (
          <div className="rounded-lg border border-status-red-border bg-status-red-surface p-3 mb-4">
            <p className="text-sm text-status-red-fg">{displayError}</p>
          </div>
        )}

        <div className="rounded-lg border border-border bg-card p-4 space-y-4">
          <div>
            <label className="text-xs text-text-secondary block mb-1">Repository URL</label>
            <input
              type="text"
              value={repoUrl}
              onChange={(e) => setRepoUrl(e.target.value)}
              placeholder="https://github.com/owner/repo"
              className="w-full px-3 py-2 rounded-md text-sm border border-border bg-page text-text-primary focus:outline-none"
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-xs text-text-muted hover:text-text-secondary"
          >
            {showAdvanced ? "▾" : "▸"} Advanced settings
          </button>

          {showAdvanced && (
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs text-text-secondary block mb-1">Budget ($)</label>
                <input type="number" step="0.01" value={maxCostUsd}
                  onChange={(e) => setMaxCostUsd(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-md text-sm border border-border bg-page text-text-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">Max tokens</label>
                <input type="number" value={maxTokens}
                  onChange={(e) => setMaxTokens(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-md text-sm border border-border bg-page text-text-primary focus:outline-none" />
              </div>
              <div>
                <label className="text-xs text-text-secondary block mb-1">Timeout (ms)</label>
                <input type="number" value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  className="w-full px-2 py-1.5 rounded-md text-sm border border-border bg-page text-text-primary focus:outline-none" />
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-medium hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Starting..." : "Start Workspace"}
            </button>
            <button
              type="button"
              onClick={loadLastConfig}
              className="px-3 py-2 rounded-md text-sm border border-border text-text-secondary hover:bg-hover"
            >
              Last Config
            </button>
          </div>
        </div>
      </form>
    </div>
  )
}
