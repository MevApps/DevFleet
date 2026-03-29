// src/components/composites/table-view.tsx
"use client"
import { useState, useMemo } from "react"
import { useDashboardStore } from "@/lib/store"
import { useInspectorStore } from "@/lib/inspector-store"
import { StatusBadge } from "@/components/primitives/status-badge"
import { BulkActionBar } from "./bulk-action-bar"
import {
  sortTasks,
  filterTasks,
  type TableTask,
  type SortConfig,
  type ColumnFilters,
} from "@/lib/hooks/use-table-state"
import { formatCurrency, formatTimeAgo } from "@/lib/utils/format"
import { cn } from "@/lib/utils"
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react"

type SortableColumn = keyof TableTask

const COLUMNS: { key: SortableColumn; label: string; filterable: boolean }[] = [
  { key: "description", label: "Task", filterable: true },
  { key: "goalDescription", label: "Goal", filterable: true },
  { key: "phase", label: "Phase", filterable: true },
  { key: "status", label: "Status", filterable: true },
  { key: "assignedTo", label: "Agent", filterable: true },
  { key: "budgetUsed", label: "Budget", filterable: false },
  { key: "lastActivity", label: "Last Activity", filterable: false },
]

export function TableView() {
  const allTasks = useDashboardStore((s) => s.allTasks)
  const goals = useDashboardStore((s) => s.goals)
  const openInspector = useInspectorStore((s) => s.open)

  const [sort, setSort] = useState<SortConfig>({ column: "lastActivity", direction: "desc" })
  const [filters, setFilters] = useState<ColumnFilters>({})
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  // Enrich tasks with goal data
  const goalMap = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals])
  const tableTasks: TableTask[] = useMemo(
    () =>
      allTasks.map((t) => {
        const goal = goalMap.get(t.goalId)
        return {
          id: t.id,
          goalId: t.goalId,
          goalDescription: goal?.description ?? "Unknown",
          description: t.description.split("\n")[0],
          phase: t.phase,
          status: t.status,
          assignedTo: t.assignedTo,
          budgetUsed: t.budget.maxCostUsd - t.budget.remaining,
          lastActivity: goal?.completedAt ?? goal?.createdAt ?? "",
        }
      }),
    [allTasks, goalMap],
  )

  const filtered = useMemo(() => filterTasks(tableTasks, filters), [tableTasks, filters])
  const sorted = useMemo(() => sortTasks(filtered, sort), [filtered, sort])

  const toggleSort = (column: SortableColumn) => {
    setSort((prev) =>
      prev.column === column
        ? { column, direction: prev.direction === "asc" ? "desc" : "asc" }
        : { column, direction: "asc" },
    )
  }

  const setFilter = (column: string, value: string) => {
    setFilters((prev) => ({ ...prev, [column]: value }))
  }

  const toggleRow = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    if (selectedIds.size === sorted.length) {
      setSelectedIds(new Set())
    } else {
      setSelectedIds(new Set(sorted.map((t) => t.id)))
    }
  }

  const handleBulkRetry = () => {
    // TODO: Wire to API in future — for now, clear selection
    setSelectedIds(new Set())
  }

  const handleBulkReassign = () => {
    // TODO: Wire to API in future — for now, clear selection
    setSelectedIds(new Set())
  }

  const handleBulkDiscard = () => {
    // TODO: Wire to API in future — for now, clear selection
    setSelectedIds(new Set())
  }

  if (allTasks.length === 0) {
    return <p className="text-sm text-text-muted py-6 text-center">No tasks to display.</p>
  }

  return (
    <div>
      <BulkActionBar
        selectedCount={selectedIds.size}
        onRetry={handleBulkRetry}
        onReassign={handleBulkReassign}
        onDiscard={handleBulkDiscard}
        onClearSelection={() => setSelectedIds(new Set())}
      />

      <div className="rounded-lg border border-border overflow-hidden">
        <table className="w-full text-[12px]">
          <thead>
            {/* Header row */}
            <tr className="bg-bg-hover border-b border-border">
              <th className="w-10 px-3 py-2">
                <input
                  type="checkbox"
                  checked={sorted.length > 0 && selectedIds.size === sorted.length}
                  onChange={toggleAll}
                  className="rounded border-border"
                />
              </th>
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-3 py-2 text-left font-semibold text-text-muted">
                  <button
                    onClick={() => toggleSort(col.key)}
                    className="flex items-center gap-1 hover:text-text-primary transition-colors"
                  >
                    {col.label}
                    {sort.column === col.key ? (
                      sort.direction === "asc" ? <ArrowUp size={12} /> : <ArrowDown size={12} />
                    ) : (
                      <ArrowUpDown size={12} className="opacity-30" />
                    )}
                  </button>
                </th>
              ))}
            </tr>
            {/* Filter row */}
            <tr className="bg-bg-card border-b border-border">
              <th className="px-3 py-1" />
              {COLUMNS.map((col) => (
                <th key={col.key} className="px-3 py-1">
                  {col.filterable ? (
                    <input
                      type="text"
                      placeholder="Filter..."
                      value={filters[col.key] ?? ""}
                      onChange={(e) => setFilter(col.key, e.target.value)}
                      className="w-full px-2 py-1 rounded border border-border bg-bg-page text-[11px] text-text-primary focus:outline-none focus:border-border-hover"
                    />
                  ) : null}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((task) => (
              <tr
                key={task.id}
                className={cn(
                  "border-b border-border hover:bg-bg-hover transition-colors cursor-pointer",
                  selectedIds.has(task.id) && "bg-status-blue-surface",
                )}
                onClick={() => openInspector(task.id, "task", task.description.slice(0, 40))}
              >
                <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(task.id)}
                    onChange={() => toggleRow(task.id)}
                    className="rounded border-border"
                  />
                </td>
                <td className="px-3 py-2 font-medium text-text-primary max-w-[200px] truncate">{task.description}</td>
                <td className="px-3 py-2 text-text-secondary max-w-[150px] truncate">{task.goalDescription}</td>
                <td className="px-3 py-2 text-status-purple-fg">{task.phase}</td>
                <td className="px-3 py-2"><StatusBadge status={task.status} /></td>
                <td className="px-3 py-2 font-mono text-text-secondary">{task.assignedTo ?? "—"}</td>
                <td className="px-3 py-2 font-mono text-text-secondary">{formatCurrency(task.budgetUsed)}</td>
                <td className="px-3 py-2 text-text-muted">{task.lastActivity ? formatTimeAgo(task.lastActivity) : "—"}</td>
              </tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-text-muted">
                  No tasks match filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-text-muted mt-2">{sorted.length} of {tableTasks.length} tasks</p>
    </div>
  )
}
