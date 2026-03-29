// src/components/inspector/__tests__/task-inspector.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { TaskInspector } from "../task-inspector"
import { useDashboardStore } from "@/lib/store"
import type { TaskDTO } from "@/lib/types"

const makeBudget = () => ({ maxTokens: 100000, maxCostUsd: 10, remaining: 5 })
const makeTask = (overrides?: Partial<TaskDTO>): TaskDTO => ({
  id: "t-1", goalId: "g-1", description: "Write OAuth handler", status: "review",
  phase: "implementation", assignedTo: "dev-03", tokensUsed: 5000,
  budget: makeBudget(), retryCount: 0, branch: "feat/oauth", ...overrides,
})

describe("TaskInspector", () => {
  beforeEach(() => {
    useDashboardStore.setState({
      activeTasks: [makeTask()],
      recentEvents: [],
    })
  })

  it("renders task description", () => {
    render(<TaskInspector entityId="t-1" />)
    expect(screen.getByText("Write OAuth handler")).toBeInTheDocument()
  })

  it("renders status and agent info", () => {
    render(<TaskInspector entityId="t-1" />)
    expect(screen.getByText("review")).toBeInTheDocument()
    expect(screen.getByText("dev-03")).toBeInTheDocument()
  })

  it("renders Diff, Artifacts, Activity tabs", () => {
    render(<TaskInspector entityId="t-1" />)
    expect(screen.getByText("Diff")).toBeInTheDocument()
    expect(screen.getByText("Artifacts")).toBeInTheDocument()
    expect(screen.getByText("Activity")).toBeInTheDocument()
  })

  it("renders Approve & Merge button for review status", () => {
    render(<TaskInspector entityId="t-1" />)
    expect(screen.getByText(/approve/i)).toBeInTheDocument()
    expect(screen.getByText(/discard/i)).toBeInTheDocument()
  })

  it("renders Retry button for failed status", () => {
    useDashboardStore.setState({ activeTasks: [makeTask({ status: "failed" })] })
    render(<TaskInspector entityId="t-1" />)
    expect(screen.getByText(/retry/i)).toBeInTheDocument()
  })

  it("shows not found for missing task", () => {
    render(<TaskInspector entityId="nonexistent" />)
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })
})
