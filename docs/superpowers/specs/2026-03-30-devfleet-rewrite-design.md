# DevFleet Rewrite — Visual Claude Code

**Date:** 2026-03-30
**Status:** Approved design
**Architects:** Uncle Bob (Code), Don Norman (UX), Jakob Nielsen (UI)

## Vision

DevFleet is a visual, multi-agent version of Claude Code. The user runs `devfleet` in their project directory, opens a web dashboard, creates goals, and watches agents build. Same power as the CLI, but with a web UI showing real-time progress and allowing intervention.

## Problems This Solves

### Architectural (Uncle Bob)
1. **No unified context contract.** Some agents read artifacts, some don't. The developer agent gets a one-line prompt and zero project knowledge. This is a missing abstraction, not a missing feature.
2. **Dependency Rule violation.** `WorkspaceRunManager` mixes use-case logic with infrastructure (git cloning, PR creation, branch detection). Five responsibilities in one class — five reasons to change.
3. **Agents start from zero.** Every agent session begins blind. The developer agent burns 50 turns on `find` and `ls` before writing code, then hits `error_max_turns` and fails. The pipeline hangs because `handleTaskFailed` never advances to the next task.

### UX (Don Norman)
4. **System model exposed, not user model.** The dashboard shows pipeline phases, agent IDs, artifact kinds, token budgets. The user thinks: "Is it working? What's it doing? Is it done?" Three questions — not answered at a glance.
5. **Silent failure.** The developer agent fails after minutes of silence. No progress feedback, no "I'm stuck," no error the user can act on. This is the gulf of evaluation — the user can't tell what happened or why.

### Usability (Jakob Nielsen)
6. **No visibility of system status.** "in_progress" for 5 minutes with no indication of what the agent is doing. Users think it's frozen.
7. **No user control.** Can't skip phases, can't retry with a hint, can't edit artifacts between phases. The pipeline is a black box.
8. **No error recovery.** When the developer agent fails, the user's only option is to start over.

## Three Contracts

### 1. Context Contract

**Principle:** Every agent receives the same context a human developer using Claude Code would have. One mechanism, all agents, no special cases.

#### ProjectContextProvider

Reads the project's context once at startup and provides it to all agents.

```typescript
interface ProjectContextProvider {
  getContext(): Promise<ProjectContext>
}

interface ProjectContext {
  readonly claudeMd: string          // CLAUDE.md content (empty string if not found)
  readonly projectConfig: ProjectConfig  // detected language, build/test commands, source roots
  readonly fileTree: string          // top-level file tree snapshot (depth-limited to avoid bloat)
}
```

**Behavior:**
- Reads `CLAUDE.md` from `process.cwd()` (the project directory). If not found, returns empty string.
- Runs `DetectProjectConfig` (already exists) for language, build/test commands, source roots.
- Generates a depth-limited file tree (max 3 levels, excludes `node_modules`, `.git`, `dist`). This gives agents immediate structural knowledge without wasting turns on `find` and `ls`.
- Runs once at system startup. Result is cached — project structure doesn't change during a pipeline run.

**Implementation:** One class, `NodeProjectContextProvider`, in `src/adapters/context/`. Implements the port `ProjectContextProvider` in `src/use-cases/ports/`.

#### ArtifactChain

Given a goal, collects all artifacts produced by completed phases — in pipeline order.

```typescript
interface ArtifactChain {
  buildContext(goalId: GoalId): Promise<string>
}
```

**Behavior:**
- Fetches all tasks for the goal from `TaskRepository`
- For each completed task (in pipeline phase order), fetches its artifacts from `ArtifactRepository`
- Formats them into a single string:
  ```
  ## Spec (from product agent)
  [spec artifact content]

  ## Plan (from architect agent)
  [plan artifact content]
  ```
- Returns empty string if no prior artifacts exist (first phase in pipeline)

**Implementation:** One class, `GoalArtifactChain`, in `src/use-cases/`. Depends on `TaskRepository`, `ArtifactRepository`, and the pipeline phase list. Pure use-case layer — no infrastructure dependencies.

#### How Agents Use It

Every agent plugin builds its system prompt the same way:

```typescript
const projectContext = await this.deps.contextProvider.getContext()
const priorWork = await this.deps.artifactChain.buildContext(task.goalId)

const systemPrompt = [
  this.deps.basePrompt,               // role-specific instructions
  projectContext.claudeMd,             // project conventions
  `Language: ${projectContext.projectConfig.language}`,
  `Source roots: ${projectContext.projectConfig.sourceRoots.join(", ")}`,
  `File structure:\n${projectContext.fileTree}`,
  priorWork,                           // spec, plan, etc. from earlier phases
].filter(Boolean).join("\n\n")
```

No special cases. DeveloperPlugin, ArchitectPlugin, ReviewerPlugin — all use the same two dependencies.

### 2. Progress Contract

**Principle:** The user sees what the agent is doing in human-readable terms, not system events.

#### AgentActivityEmitter

The `ClaudeAgentSdkAdapter` currently ignores `stream_event` messages (logged as "UNKNOWN type"). These contain the actual tool calls — what the agent is reading, writing, running.

**Change:** Parse `stream_event` messages to extract tool calls. When a tool call completes, emit an `agent.activity` message on the bus.

```typescript
// New message type
interface AgentActivityMessage extends BaseMessage {
  readonly type: "agent.activity"
  readonly agentId: AgentId
  readonly taskId: TaskId
  readonly action: string  // "Reading app-sidebar.tsx", "Writing user-avatar.tsx", "Running npm test"
}
```

**How it works:**
- The SDK streams `stream_event` messages containing Anthropic API content blocks. The exact structure may evolve with SDK versions — parse defensively with fallbacks.
- Look for tool_use content blocks: extract the tool name and first input argument.
- On tool completion, emit `agent.activity` with a human-readable summary:
  - `Read` + file_path → "Reading src/components/button.tsx"
  - `Write` + file_path → "Creating src/components/avatar.tsx"
  - `Edit` + file_path → "Editing src/components/sidebar.tsx"
  - `Bash` + command → "Running npm test"
  - `Glob` + pattern → "Searching for *.tsx files"
  - `Grep` + pattern → "Searching for 'avatar' in code"

**Dashboard side:** The SSE stream already forwards bus messages. The dashboard subscribes to `agent.activity` and shows a live feed per agent. This replaces the current "in_progress" black box with real-time visibility.

**Three levels of awareness (Don Norman):**
- **Glance:** Agent card shows green/red dot + current action text
- **Scan:** Activity feed shows last 5-10 actions per agent
- **Deep dive:** Click to see full tool call history, token usage, timing

### 3. Intervention Contract

**Principle:** Users need control points, not a black box. Ship two interventions first; add more later.

#### Skip Phases

The pipeline config already defines phases as an ordered list. Allow the user to specify which phases to include when creating a goal.

```typescript
// Goal creation API accepts optional phases
interface CreateGoalInput {
  readonly description: string
  readonly phases?: readonly string[]  // defaults to full pipeline if omitted
}
```

**Behavior:**
- If `phases` is provided, the supervisor creates tasks only for those phases.
- Valid subsets must maintain order (can't put "review" before "code").
- Example: `phases: ["code", "review"]` skips spec and plan — the developer gets the goal description directly and starts coding immediately.
- The dashboard shows a phase picker (checkboxes) in the goal creation form.

**Why this matters (Don Norman):** Most developers think "I don't need a spec and a plan for a simple button." If the pipeline forces 5 phases for every goal, users stop using it.

#### Retry with Hint

When a task fails or produces bad output, the user can retry it with additional context.

```typescript
// New API endpoint: POST /api/tasks/:taskId/retry
interface RetryTaskInput {
  readonly hint: string  // additional context from the user
}
```

**Behavior:**
- Appends the hint to the task description: `"${original description}\n\nUser hint: ${hint}"`
- Resets the task to `queued` status, increments `retryCount`
- The supervisor assigns it to the appropriate agent
- The agent sees the original task + the user's guidance

**Why this matters (Jakob Nielsen):** Error recovery. When something goes wrong, the user can course-correct without starting over.

## What Gets Deleted

The workspace cloning/isolation layer is removed entirely. DevFleet runs in the project directory — no cloning, no temp folders.

| File | Reason |
|------|--------|
| `WorkspaceRunManager` | 5 responsibilities in 1 class. Replaced by running in-project. |
| `GitCloneIsolator` | Clones repos to temp dirs. No longer needed. |
| `WorkspaceIsolator` port | Interface for cloning. No longer needed. |
| `WorkspaceRun` entity | Tracks clone lifecycle. No longer needed. |
| `WorkspaceRunRepository` port + impl | Stores workspace run records. No longer needed. |
| `CleanupWorkspace` use case | Manages workspace cleanup. No longer needed. |
| `GetWorkspaceRunStatus` use case | Queries workspace state. No longer needed. |
| `StopWorkspace` use case | Stops workspace runs. No longer needed. |
| `workspaceRoutes` | HTTP routes for workspace API. No longer needed. |
| `NodeGitRemote` + port | Pushes to remote repos. No longer needed. |
| `GitHubPullRequestCreator` + port | Creates PRs. No longer needed. |

## What Gets Created

| Component | Layer | Purpose |
|-----------|-------|---------|
| `ProjectContextProvider` port | use-cases/ports | Interface for project context |
| `NodeProjectContextProvider` | adapters/context | Reads CLAUDE.md, detects config, builds file tree |
| `GoalArtifactChain` | use-cases | Collects prior phase artifacts for a goal |
| `AgentActivityEmitter` | (inside ClaudeAgentSdkAdapter) | Parses stream events into human-readable actions |

## What Gets Changed

| Component | Change |
|-----------|--------|
| Every agent plugin | Uses `ProjectContextProvider` + `GoalArtifactChain` for context. Same pattern, no special cases. |
| `DeveloperPlugin` | Adds `artifactRepo` dependency (matches other plugins). Receives project context + prior artifacts. |
| `SupervisorPlugin.handleTaskFailed` | Advances pipeline after discarding (bug fix). Also: `handleBudgetExceeded`, `handleAgentStuck`, `handleReviewRejected` discard path. |
| `SupervisorPlugin.handleGoalCreated` | Accepts optional phase list from goal. Creates tasks only for requested phases. |
| `ClaudeAgentSdkAdapter` | Parses `stream_event` messages for tool calls. Emits `agent.activity` on the bus. |
| `composition-root` | Removes workspace wiring. Adds `ProjectContextProvider` and `GoalArtifactChain`. Injects them into all plugins. |
| CLI (`index.ts`) | Removes readline prompt. Starts API server + dashboard. Prints URL. |
| `CreateGoalFromCeo` | Accepts optional `phases` parameter. |
| Dashboard goal form | Adds phase picker (checkboxes) and retry-with-hint button on failed tasks. |

## What Stays Untouched

- Entity models (Task, Goal, Artifact, Budget, Agent)
- Bus/event system (InMemoryBus)
- Storage layer (InMemory repos)
- Dashboard components (layout, sidebar, inspector, live floor)
- Worktree manager (still used for git branch isolation during developer coding)
- Pipeline config entity
- All existing agent prompt files

## Expected Impact

| Metric | Before | After |
|--------|--------|-------|
| Developer agent turns to start coding | ~25 (exploring) | ~3 (has context) |
| Developer phase success rate | 0% (always hits max_turns) | High (context eliminates blind exploration) |
| Pipeline failure on task error | Hangs forever | Advances to next task |
| User feedback during agent work | "in_progress" for minutes | Live activity feed per agent |
| Minimum phases for simple tasks | 5 (forced) | 1-5 (user chooses) |
| Startup time | Clone + install (~30s) | Instant (already in project) |
