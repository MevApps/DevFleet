// src/components/composites/__tests__/workspace-gate.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { WorkspaceGate } from "../workspace-gate"
import { useWorkspaceStore } from "@/lib/workspace-store"

describe("WorkspaceGate", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().clear()
  })

  it("renders setup form when no workspace exists", () => {
    render(<WorkspaceGate>{() => <div>Floor Content</div>}</WorkspaceGate>)
    expect(screen.queryByText("Floor Content")).not.toBeInTheDocument()
  })

  it("renders children when workspace is active", () => {
    useWorkspaceStore.getState().setStatus({
      run: {
        id: "ws-1",
        config: { repoUrl: "https://github.com/test/repo" },
        status: "active",
        projectConfig: null,
        startedAt: "2026-03-29T10:00:00Z",
        completedAt: null,
        error: null,
      },
      costUsd: 0,
      goalSummaries: [],
    })
    render(<WorkspaceGate>{() => <div>Floor Content</div>}</WorkspaceGate>)
    expect(screen.getByText("Floor Content")).toBeInTheDocument()
  })
})
