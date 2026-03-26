import { type Task } from "./Task"

export interface PhaseTransition {
  readonly from: string
  readonly to: string
}

export interface PipelineConfig {
  readonly phases: readonly string[]
  readonly transitions: readonly PhaseTransition[]
  readonly skipAllowed: ReadonlyArray<{
    from: string
    to: string
    condition: string
  }>
}

export interface CreatePipelineConfigParams {
  phases: readonly string[]
  transitions: readonly PhaseTransition[]
  skipAllowed?: ReadonlyArray<{
    from: string
    to: string
    condition: string
  }>
}

export function createPipelineConfig(params: CreatePipelineConfigParams): PipelineConfig {
  return {
    phases: params.phases,
    transitions: params.transitions,
    skipAllowed: params.skipAllowed ?? [],
  }
}

/**
 * Returns true if a task can advance to the given phase according to the pipeline.
 * Uses the explicit transitions list — no implicit ordering.
 */
export function canAdvancePhase(
  task: Pick<Task, "phase">,
  to: string,
  pipeline: PipelineConfig,
): boolean {
  return pipeline.transitions.some((t) => t.from === task.phase && t.to === to)
}
