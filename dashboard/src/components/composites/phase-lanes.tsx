import type { TaskDTO } from "@/lib/types"

interface PhaseLanesProps {
  tasks: readonly TaskDTO[]
  onTaskClick: (task: TaskDTO) => void
}

export function PhaseLanes({ tasks, onTaskClick }: PhaseLanesProps) {
  return <div data-testid="phase-lanes" />
}
