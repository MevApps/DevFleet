import { describe, it, expect, beforeEach } from "vitest"
import { useWorkspaceStore } from "../workspace-store"
import type { WorkspaceStatusDTO } from "../types"

const makeStatusDTO = (overrides?: Partial<WorkspaceStatusDTO>): WorkspaceStatusDTO => ({
  run: {
    id: "ws-1",
    config: { repoUrl: "https://github.com/acme/app" },
    status: "active",
    projectConfig: { language: "typescript", testCommand: "npm test", installCommand: "npm install" },
    startedAt: "2026-03-28T10:00:00Z",
    completedAt: null,
    error: null,
  },
  costUsd: 2.47,
  goalSummaries: [
    { goalId: "g-1", description: "Add auth", status: "delivered", costUsd: 0.82, durationMs: 180_000, prUrl: "https://github.com/acme/app/pull/14" },
  ],
  ...overrides,
})

describe("useWorkspaceStore", () => {
  beforeEach(() => {
    useWorkspaceStore.getState().clear()
  })

  it("starts with null run", () => {
    expect(useWorkspaceStore.getState().run).toBeNull()
    expect(useWorkspaceStore.getState().goalSummaries).toEqual([])
    expect(useWorkspaceStore.getState().costUsd).toBe(0)
    expect(useWorkspaceStore.getState().error).toBeNull()
  })

  it("setStatus populates run, goalSummaries, costUsd and clears error", () => {
    useWorkspaceStore.getState().setError("previous error")
    const dto = makeStatusDTO()
    useWorkspaceStore.getState().setStatus(dto)

    const state = useWorkspaceStore.getState()
    expect(state.run?.id).toBe("ws-1")
    expect(state.run?.status).toBe("active")
    expect(state.goalSummaries).toHaveLength(1)
    expect(state.goalSummaries[0].goalId).toBe("g-1")
    expect(state.costUsd).toBe(2.47)
    expect(state.error).toBeNull()
  })

  it("setError sets error", () => {
    useWorkspaceStore.getState().setError("something broke")
    expect(useWorkspaceStore.getState().error).toBe("something broke")
  })

  it("clear resets all state", () => {
    useWorkspaceStore.getState().setStatus(makeStatusDTO())
    useWorkspaceStore.getState().clear()

    const state = useWorkspaceStore.getState()
    expect(state.run).toBeNull()
    expect(state.goalSummaries).toEqual([])
    expect(state.costUsd).toBe(0)
    expect(state.error).toBeNull()
  })
})
