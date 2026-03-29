import { create } from "zustand"
import type { WorkspaceRunDTO, WorkspaceGoalSummaryDTO, WorkspaceStatusDTO } from "./types"

interface WorkspaceState {
  run: WorkspaceRunDTO | null
  goalSummaries: readonly WorkspaceGoalSummaryDTO[]
  costUsd: number
  error: string | null

  setStatus: (dto: WorkspaceStatusDTO) => void
  setError: (error: string | null) => void
  clear: () => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  run: null,
  goalSummaries: [],
  costUsd: 0,
  error: null,

  setStatus: (dto) =>
    set({ run: dto.run, goalSummaries: dto.goalSummaries ?? [], costUsd: dto.costUsd ?? 0, error: null }),

  setError: (error) => set({ error }),

  clear: () => set({ run: null, goalSummaries: [], costUsd: 0, error: null }),
}))
