// src/lib/hooks/use-table-state.ts

export interface TableTask {
  readonly id: string
  readonly goalId: string
  readonly goalDescription: string
  readonly description: string
  readonly phase: string
  readonly status: string
  readonly assignedTo: string | null
  readonly budgetUsed: number
  readonly lastActivity: string
}

export interface SortConfig {
  readonly column: keyof TableTask
  readonly direction: "asc" | "desc"
}

export type ColumnFilters = Partial<Record<keyof TableTask, string>>

export function sortTasks(tasks: readonly TableTask[], sort: SortConfig): TableTask[] {
  return [...tasks].sort((a, b) => {
    const aVal = a[sort.column]
    const bVal = b[sort.column]
    if (aVal == null && bVal == null) return 0
    if (aVal == null) return 1
    if (bVal == null) return -1
    const cmp = typeof aVal === "number" && typeof bVal === "number"
      ? aVal - bVal
      : String(aVal).localeCompare(String(bVal))
    return sort.direction === "asc" ? cmp : -cmp
  })
}

export function filterTasks(tasks: readonly TableTask[], filters: ColumnFilters): TableTask[] {
  const activeFilters = Object.entries(filters).filter(([, v]) => v && v.trim() !== "")
  if (activeFilters.length === 0) return [...tasks]
  return tasks.filter((task) =>
    activeFilters.every(([col, query]) => {
      const val = task[col as keyof TableTask]
      return val != null && String(val).toLowerCase().includes(query!.toLowerCase())
    })
  )
}
