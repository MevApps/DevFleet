# Workspace Page Design

> A dashboard page for configuring and running DevFleet against any repository,
> with automated push, PR creation, and optional auto-merge.

## Motivation

Running DevFleet against a repo currently requires terminal commands, env vars, and
manual cleanup. The workspace page makes this accessible to team members who don't
know the internals — one form to set up, existing goal form to give it work, and
fully automated delivery of results to the remote repo.

## Success Criteria

1. Team member can start a workspace from the dashboard in under 30 seconds
2. Goals created from Live Floor target the active workspace
3. Completed goals auto-push and create PRs on the remote repo
4. Auto-merge is available behind a feature flag (default: off)
5. Workspace cleanup is automatic on stop, with failed goals preserved for debugging

## Constraints

- **API keys:** Server env vars (`ANTHROPIC_API_KEY`, `GITHUB_TOKEN`) — no keys in the UI
- **Auto-merge:** Feature flag `DEVFLEET_AUTO_MERGE` (default: false)
- **Storage:** In-memory for v1 — workspace state lost on server restart
- **Concurrency:** One active workspace at a time for v1

---

## Layer 1: Entities

### WorkspaceRun

```typescript
interface WorkspaceRun {
  readonly id: WorkspaceRunId
  readonly config: WorkspaceRunConfig
  readonly status: WorkspaceRunStatus
  readonly projectConfig: ProjectConfig | null
  readonly startedAt: Date
  readonly completedAt: Date | null
  readonly error: string | null
}

type WorkspaceRunStatus =
  | "created"
  | "cloning"
  | "detecting"
  | "active"
  | "stopped"
  | "failed"

interface WorkspaceRunConfig {
  readonly repoUrl: string
  readonly maxCostUsd: number       // default: 10.0
  readonly maxTokens: number        // default: 200_000
  readonly supervisorModel: string  // default: "claude-opus-4-20250514"
  readonly developerModel: string   // default: "claude-sonnet-4-20250514"
  readonly reviewerModel: string    // default: "claude-opus-4-20250514"
  readonly timeoutMs: number        // default: 600_000
}
```

**Design decisions:**
- No `clonePath` on entity — managed by `WorkspaceIsolator` adapter
- No `costUsd` on entity — derived on demand from `MetricRecorder`/`EventStore`
- No `messageTrace` on entity — queried from `EventStore`
- No `goalId` on entity — a workspace is a session that receives multiple goals via the existing goal creation flow; goals are tracked in `GoalRepository`
- Status lifecycle: `created → cloning → detecting → active → stopped/failed`
- A workspace is a **session** that can receive multiple goals while active

---

## Layer 2: Use Cases

### StartWorkspaceRun

```
Input:  WorkspaceRunConfig
Output: WorkspaceRunId

1. Create WorkspaceRun entity (status: created)
2. Clone repo via WorkspaceIsolator.create(repoUrl) (status: cloning)
3. Return WorkspaceRunId immediately
4. Kick off BootWorkspace asynchronously
```

Returns the ID synchronously. Clone + boot happens async. Caller watches
progress via SSE.

### BootWorkspace

```
Input:  WorkspaceRunId
Output: void (async, updates status via events)

1. Run DetectProjectConfig against clone (status: detecting)
2. Build a fresh DevFleetSystem for the clone directory
3. Start the system (status: active)
4. Subscribe to goal lifecycle events for auto-push/PR
```

Separated from `StartWorkspaceRun` so clone errors are synchronous and
pipeline errors are async — different error paths, different handlers.

### StopWorkspace

```
Input:  WorkspaceRunId
Output: void

1. Stop the DevFleetSystem
2. Cleanup clone via WorkspaceIsolator.cleanup()
3. Set status: stopped
```

Only valid when status is `active`. If goals are currently running, the
API returns an error — user must wait for completion or the timeout.
Cleanup always removes the clone on stop (success or failure). Failed
goals' artifacts and events are preserved in the EventStore for
inspection via the status endpoint before stopping.

### GetWorkspaceRunStatus

```
Input:  WorkspaceRunId
Output: {
  run: WorkspaceRun,
  events: Message[],
  costUsd: number,
  goalSummaries: GoalSummary[]
}
```

All derived data — queries EventStore, MetricRecorder, GoalRepository.
`GoalSummary` includes: goalId, description, status, costUsd, duration, prUrl.

### WorkspaceRunManager

Orchestrator that owns the lifecycle of active workspace runs.

```
startRun(config) → runId
getStatus(runId) → status DTO
stop(runId)
getEventStream(runId) → MessagePort (for SSE)
stopAll() → called on server shutdown
```

Internally holds `Map<WorkspaceRunId, DevFleetSystem>`. Encapsulated — the
HTTP layer and use cases interact through the manager, not the map directly.

Responsibilities:
- Track active systems
- Handle goal.completed/goal.abandoned event subscriptions
- Ensure system.stop() called exactly once per run
- Auto-push + PR creation on goal completion
- Auto-merge when feature flag is enabled

---

## Layer 2: Event-Driven — Goal Completion Flow

When a goal completes inside an active workspace:

```
goal.completed
  → GitRemote.push(branch, remoteUrl)
  → PullRequestCreator.create(repoUrl, branch, title, body) → prUrl
  → if DEVFLEET_AUTO_MERGE=true:
      → PullRequestCreator.merge(prUrl)
  → emit workspace.goal.delivered { goalId, prUrl, merged: boolean }
```

**PR content** assembled from pipeline artifacts:

```markdown
## Goal
<goal description>

## What was done
<spec artifact content>

## Implementation Plan
<plan artifact content>

## Test Results
<test report: X passed, 0 failed>

---
Generated by DevFleet
```

When a goal is abandoned:

```
goal.abandoned
  → Log failure reason
  → Clone preserved (not cleaned up)
  → emit workspace.goal.failed { goalId, reason }
```

---

## New Ports

### WorkspaceIsolator

```typescript
interface WorkspaceHandle {
  readonly id: string
}

interface WorkspaceIsolator {
  create(repoUrl: string): Promise<WorkspaceHandle>
  getPath(handle: WorkspaceHandle): string
  cleanup(handle: WorkspaceHandle): Promise<void>
}
```

Adapter: `GitCloneIsolator` — uses `git clone` to temp dir, `rm -rf` for
cleanup. The `WorkspaceHandle` wraps the temp dir path internally.

### WorkspaceRunRepository

```typescript
interface WorkspaceRunRepository {
  create(run: WorkspaceRun): Promise<void>
  findById(id: WorkspaceRunId): Promise<WorkspaceRun | null>
  findActive(): Promise<WorkspaceRun | null>
  update(run: WorkspaceRun): Promise<void>
}
```

Adapter: `InMemoryWorkspaceRunRepository` for v1.

### GitRemote

```typescript
interface GitRemote {
  push(branch: string, remoteUrl: string, clonePath: string): Promise<void>
}
```

Adapter: `NodeGitRemote` — uses `git push` via `ShellExecutor`.

### PullRequestCreator

```typescript
interface PullRequestCreator {
  create(params: {
    repoUrl: string
    branch: string
    title: string
    body: string
  }): Promise<string>  // returns PR URL

  merge(prUrl: string): Promise<void>
}
```

Adapter: `GitHubPullRequestCreator` — uses `gh` CLI or GitHub REST API.
`merge` only called when `DEVFLEET_AUTO_MERGE=true`.

---

## Layer 3: API Endpoints

### `POST /api/workspace/start`

```
Body: { repoUrl, maxCostUsd?, maxTokens?, supervisorModel?, developerModel?, reviewerModel?, timeoutMs? }
Response: { runId: string }
```

Calls `WorkspaceRunManager.startRun()`.

### `GET /api/workspace/status`

```
Response: {
  run: { id, config, status, projectConfig, startedAt, completedAt, error },
  costUsd: number,
  goalSummaries: [{ goalId, description, status, costUsd, durationMs, prUrl }],
  events: Message[]
}
```

Returns the active workspace status. 404 if no active workspace.

### `POST /api/workspace/stop`

```
Response: { status: "stopped" }
```

Calls `WorkspaceRunManager.stop()`. Warns if active goals.

### `GET /api/workspace/events`

SSE stream scoped to the active workspace. Streams all bus events from
the workspace's `DevFleetSystem`.

### Existing endpoint change: `POST /api/goals`

When a workspace is active, goal creation targets the workspace's system
instead of the main system. The goal route handler checks
`WorkspaceRunManager.findActive()` — if an active workspace exists, it uses
that workspace's `DevFleetSystem` (goalRepo, bus) to create the goal and
emit `goal.created`. If no workspace is active, it falls back to the main
system (existing behavior).

---

## Layer 4: UI — Workspace Page

### Route: `/workspace`

### State 1: No active workspace

- Simple form: Repository URL (required) + "Start Workspace" button
- Collapsed "Advanced settings": budget, models, timeout
- "Last config" button restores from localStorage

### State 2: Workspace active

- **Info bar:** Repo name, detected project config (language, commands), "Stop Workspace" button
- **Stats row:** Goals run, active goals, total cost, uptime
- **Activity log:** Goal history with status, cost, duration, PR link
- **Guidance note:** "Create goals from the Live Floor page"

### State transitions

- "Start Workspace" → shows cloning/detecting progress → transitions to active state
- "Stop Workspace" → confirmation dialog if active goals → transitions to setup state
- On server restart → resets to setup state (in-memory storage)

### Navigation

Add "Workspace" to sidebar under the "Workflow" section, between "Pipeline" and "Goals".

---

## New Message Types

```typescript
interface WorkspaceGoalDeliveredMessage extends BaseMessage {
  readonly type: "workspace.goal.delivered"
  readonly goalId: GoalId
  readonly prUrl: string
  readonly merged: boolean
}

interface WorkspaceGoalFailedMessage extends BaseMessage {
  readonly type: "workspace.goal.failed"
  readonly goalId: GoalId
  readonly reason: string
}

interface WorkspaceStatusChangedMessage extends BaseMessage {
  readonly type: "workspace.status.changed"
  readonly runId: string
  readonly status: WorkspaceRunStatus
}
```

---

## Auto-Merge Feature Flag

```
DEVFLEET_AUTO_MERGE=true|false (default: false)
```

When `false`: PR is created but not merged. Human reviews and merges.
When `true`: PR is created and immediately merged. Human reviews features
in the running app, not in the code.

The flag is read at event-handling time — can be toggled without restart
by updating the env var (or via a future settings API).

**Rationale for default off:** The Reviewer agent has zero track record on
real code. Build trust through data — review the first 10-50 PRs manually.
When confidence is high, flip the flag.

---

## Known Limitations

1. **One workspace at a time** — v1 supports a single active workspace.
   Multi-workspace requires run isolation and UI routing.

2. **In-memory storage** — Workspace state lost on server restart.
   PostgreSQL adapter is not in scope.

3. **No per-user API keys** — Server env vars only. Per-user keys
   require user identity, which doesn't exist yet.

4. **GitHub only** — `PullRequestCreator` adapter targets GitHub.
   GitLab/Bitbucket adapters can be added later behind the same port.

5. **No run history** — v1 shows only the current/last workspace.
   Run history requires persistent storage.

6. **Auto-merge trust** — The Reviewer agent's judgment is unvalidated.
   Auto-merge should remain off until sufficient confidence is built.

---

## Out of Scope

- PostgreSQL storage
- Multi-workspace concurrency
- Per-user API keys / authentication
- GitLab/Bitbucket adapters
- Run history
- WebSocket for bidirectional control
- Settings page for feature flags (env vars for v1)
