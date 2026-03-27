import type { TaskRepository } from "../../use-cases/ports/TaskRepository"
import type { GoalRepository } from "../../use-cases/ports/GoalRepository"
import type { PipelineDTO } from "./dto"
import { toTaskDTO, toGoalDTO } from "./mappers"

export class PipelinePresenter {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly goals: GoalRepository,
    private readonly phases: readonly string[],
  ) {}

  async present(): Promise<PipelineDTO> {
    const [allTasks, allGoals] = await Promise.all([this.tasks.findAll(), this.goals.findAll()])
    const tasksByPhase: Record<string, ReturnType<typeof toTaskDTO>[]> = {}
    for (const phase of this.phases) { tasksByPhase[phase] = [] }
    for (const task of allTasks) { if (tasksByPhase[task.phase]) { tasksByPhase[task.phase].push(toTaskDTO(task)) } }
    return { phases: [...this.phases], tasksByPhase, goals: allGoals.map(toGoalDTO) }
  }
}
