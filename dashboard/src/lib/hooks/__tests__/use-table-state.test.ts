// src/lib/hooks/__tests__/use-table-state.test.ts
import { describe, it, expect } from "vitest"
import {
  sortTasks,
  filterTasks,
  type SortConfig,
  type ColumnFilters,
  type TableTask,
} from "../use-table-state"

const makeTableTask = (overrides?: Partial<TableTask>): TableTask => ({
  id: "t-1",
  goalId: "g-1",
  goalDescription: "OAuth2",
  description: "Write handler",
  phase: "implementation",
  status: "in_progress",
  assignedTo: "dev-01",
  budgetUsed: 5.0,
  lastActivity: "2026-03-29T14:00:00Z",
  ...overrides,
})

describe("sortTasks", () => {
  it("sorts by description ascending", () => {
    const tasks = [
      makeTableTask({ id: "t-2", description: "Zulu task" }),
      makeTableTask({ id: "t-1", description: "Alpha task" }),
    ]
    const sorted = sortTasks(tasks, { column: "description", direction: "asc" })
    expect(sorted[0].description).toBe("Alpha task")
    expect(sorted[1].description).toBe("Zulu task")
  })

  it("sorts by description descending", () => {
    const tasks = [
      makeTableTask({ id: "t-1", description: "Alpha task" }),
      makeTableTask({ id: "t-2", description: "Zulu task" }),
    ]
    const sorted = sortTasks(tasks, { column: "description", direction: "desc" })
    expect(sorted[0].description).toBe("Zulu task")
  })

  it("sorts by budgetUsed numerically", () => {
    const tasks = [
      makeTableTask({ id: "t-1", budgetUsed: 10 }),
      makeTableTask({ id: "t-2", budgetUsed: 2 }),
    ]
    const sorted = sortTasks(tasks, { column: "budgetUsed", direction: "asc" })
    expect(sorted[0].budgetUsed).toBe(2)
  })
})

describe("filterTasks", () => {
  it("filters by single column", () => {
    const tasks = [
      makeTableTask({ id: "t-1", description: "Write OAuth handler" }),
      makeTableTask({ id: "t-2", description: "Fix Redis bug" }),
    ]
    const filtered = filterTasks(tasks, { description: "oauth" })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe("t-1")
  })

  it("filters by multiple columns with AND logic", () => {
    const tasks = [
      makeTableTask({ id: "t-1", description: "Write handler", status: "in_progress" }),
      makeTableTask({ id: "t-2", description: "Write tests", status: "completed" }),
      makeTableTask({ id: "t-3", description: "Fix bug", status: "in_progress" }),
    ]
    const filtered = filterTasks(tasks, { description: "write", status: "in_progress" })
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe("t-1")
  })

  it("returns all tasks when no filters", () => {
    const tasks = [makeTableTask(), makeTableTask({ id: "t-2" })]
    expect(filterTasks(tasks, {})).toHaveLength(2)
  })

  it("is case-insensitive", () => {
    const tasks = [makeTableTask({ description: "UPPERCASE task" })]
    expect(filterTasks(tasks, { description: "uppercase" })).toHaveLength(1)
  })
})
