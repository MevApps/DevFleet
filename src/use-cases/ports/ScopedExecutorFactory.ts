import type { AgentExecutor } from "./AgentExecutor"

/**
 * A factory that produces an AgentExecutor scoped to a specific working directory.
 *
 * Why this exists: DeveloperPlugin must run tasks in a git worktree isolated to the task
 * branch. The worktree path is only known at handle-time, after the branch is created.
 * DeveloperPlugin receives this factory (a port) so it can construct a scoped executor
 * without depending on concrete infrastructure classes — keeping the adapter layer clean.
 */
export type ScopedExecutorFactory = (workingDir: string) => AgentExecutor
