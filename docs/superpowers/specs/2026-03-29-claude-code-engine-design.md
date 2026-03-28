# Claude Code Engine: Replace API with Agent SDK

**Date:** 2026-03-29
**Status:** Approved
**Goal:** Replace the Anthropic API with Claude Code (via Agent SDK) so the engine runs on the Max plan with zero API costs.

## Overview

The engine currently calls the Anthropic Messages API directly via `@anthropic-ai/sdk`. This requires an API key and per-token billing. The new design replaces this with `@anthropic-ai/claude-agent-sdk`, which runs Claude Code sessions programmatically using the Max plan subscription.

This is not an adapter swap. The execution model changes from **request-response** (engine drives turns, executes tools, feeds results back) to **fire-and-observe** (engine launches a session, Claude Code handles turns and tools internally, engine watches the stream).

## Section 1: New Port Contract

The old ports (`AICompletionProvider`, `AIToolProvider`) are replaced by a single new port:

```typescript
type AgentCapability = "file_access" | "shell" | "web"

interface PhaseTask {
  readonly systemPrompt: string
  readonly taskDescription: string
  readonly workingDir: string
  readonly capabilities: ReadonlyArray<AgentCapability>
  readonly maxTurns?: number
  readonly model?: string
}

interface AgentSession {
  launch(task: PhaseTask, signal: AbortSignal): AsyncIterable<SessionEvent>
}

type SessionEvent =
  | { type: "started"; sessionId: string; model: string }
  | { type: "tool_used"; name: string; input: string }
  | { type: "tool_result"; name: string; success: boolean; output: string }
  | { type: "text"; content: string }
  | { type: "turn_completed"; tokensIn: number; tokensOut: number }
  | { type: "completed"; result: string; totalTokensIn: number;
      totalTokensOut: number; durationMs: number; numTurns: number }
  | { type: "error"; reason: string }
```

**Design decisions:**
- `AgentCapability` uses domain language (`"file_access"`, `"shell"`), not Claude Code tool names (`"Read"`, `"Bash"`). The adapter handles the mapping.
- `AbortSignal` enables budget-based session termination mid-flight.
- `PhaseTask.model` is optional — preserves the ability to use different models per agent role if the plan supports it.
- Token counts are available per-turn (from `assistant` SDK events) and in aggregate (from `result` SDK events).

## Section 2: Component Changes

### Deleted

| File | Reason |
|---|---|
| `use-cases/ports/AIProvider.ts` | Old contract (`complete`, `completeWithTools`, `ToolDefinition`, `ToolCall`) is the wrong abstraction for fire-and-observe. No remaining consumers after Ops cleanup. |
| `adapters/ai-providers/ClaudeProvider.ts` | Replaced by `ClaudeAgentSdkAdapter`. |
| `use-cases/PromptAgent.ts` | Its only job was choosing between `complete` vs `completeWithTools`. That decision no longer exists. |
| `use-cases/ExecuteToolCalls.ts` | Claude Code executes its own tools. The engine observes, not drives. |
| `adapters/ai-providers/DeterministicProvider.ts` | Ops stops pretending to be an AI agent. Replaced by `RunBuildAndTest`. |
| `entities/Conversation.ts` | Claude Code manages conversation turns internally. |
| `use-cases/RunAgentLoop.ts` | Replaced by `RunAgentSession` (LLM agents) and `RunBuildAndTest` (Ops). |
| `scopedExecutorFactory` (in composition-root) | Scoping moves to `PhaseTask.workingDir`. |
| `@anthropic-ai/sdk` dependency | Replaced by `@anthropic-ai/claude-agent-sdk`. |

### New

| File | Purpose |
|---|---|
| `use-cases/ports/AgentSession.ts` | New port: `AgentSession` interface, `PhaseTask`, `SessionEvent`, `AgentCapability`. |
| `adapters/ai-providers/ClaudeAgentSdkAdapter.ts` | Implements `AgentSession`. Wraps SDK `query()`. Maps capabilities to Claude Code tool names. ~50-80 lines. |
| `adapters/ai-providers/MockAgentSession.ts` | Implements `AgentSession` for test/demo mode. Yields fake `SessionEvent`s. |
| `use-cases/RunAgentSession.ts` | Launches session, iterates stream, records metrics, handles abort. Replaces `RunAgentLoop` for LLM agents. |
| `use-cases/RunBuildAndTest.ts` | Runs build + test shell commands directly. Replaces `DeterministicProvider` + `RunAgentLoop` for Ops. |

### Rewritten

| File | What changes |
|---|---|
| `use-cases/ports/AgentExecutor.ts` | `AgentConfig.tools` becomes `AgentConfig.capabilities`. `AgentEvent` types updated to match `SessionEvent` data. |
| `use-cases/EvaluateTurnOutcome.ts` | Renamed to `EvaluateOutcome`. Evaluates session result, not per-turn outcome. Input shape changes from `{ stopReason, toolResults }` to session-level result content. |
| `adapters/plugins/agents/OpsPlugin.ts` | Uses `RunBuildAndTest` instead of `RunAgentLoop`. |
| `infrastructure/config/composition-root.ts` | New wiring (see Section 6). |

### Untouched

| Component | Why it survives |
|---|---|
| `SupervisorPlugin` + pipeline flow | Controls phase transitions, keep/discard, retries. Calls the executor port, doesn't care what's behind it. |
| `DeveloperPlugin` + worktree creation | Creates worktrees, passes path via executor. |
| `ProductPlugin`, `ArchitectPlugin`, `ReviewerPlugin` | Subscribe to `task.assigned`, call the executor. |
| `LearnerPlugin` + keep/discard repo | Observes outcomes. |
| `RecordTurnMetrics` | Called by `RunAgentSession` with data from `turn_completed` events. |
| `CheckBudget` | Called before launch + during stream. Triggers abort if exceeded. |
| All storage repos, bus, event store | Pure infrastructure, no AI dependency. |
| Dashboard (Next.js), SSE, presenters | Consume events from the bus. Don't care how agents ran. |
| `ports/FileSystem.ts`, `ports/ShellExecutor.ts` | Used by `RunBuildAndTest` for Ops. Developer file ops handled by Claude Code internally. |

## Section 3: The Adapter

`ClaudeAgentSdkAdapter` is the only file that knows Claude Code exists:

1. **Map** domain capabilities to Claude Code tool names:
   - `"file_access"` -> `["Read", "Write", "Edit", "Glob", "Grep"]`
   - `"shell"` -> `["Bash"]`
   - `"web"` -> `["WebFetch", "WebSearch"]`

2. **Call** SDK `query()` with:
   - `prompt`: `task.taskDescription`
   - `systemPrompt`: `task.systemPrompt`
   - `cwd`: `task.workingDir`
   - `allowedTools`: mapped tool names
   - `maxTurns`: `task.maxTurns`
   - `model`: `task.model` (if provided)
   - `includePartialMessages`: `true`
   - `abortSignal`: passed through

3. **Translate** `SDKMessage` to `SessionEvent`:
   - `system` (init) -> `{ type: "started" }`
   - `content_block_start` (tool_use) -> `{ type: "tool_used" }`
   - `user` (tool result) -> `{ type: "tool_result" }`
   - text deltas -> `{ type: "text" }`
   - `assistant` -> `{ type: "turn_completed", tokensIn, tokensOut }` (from `message.usage`)
   - `result` -> `{ type: "completed", ... }` (from aggregate stats)
   - error subtypes -> `{ type: "error" }`

Properties: thin, stateless, no logic beyond mapping. If the SDK changes, this is the only file to rewrite.

## Section 4: RunAgentSession

Replaces `RunAgentLoop`. Same position in the architecture (Layer 2 use case), different job.

**Dependencies:** `AgentSession`, `CheckBudget`, `RecordTurnMetrics`, `EvaluateOutcome`, `TaskRepository`

**Flow:**
1. **Before launch:** `CheckBudget` — can we even start?
2. **Launch:** Create `AbortController`, call `agentSession.launch(task, signal)`
3. **During stream** (iterating `SessionEvent`s):
   - `started` -> emit dashboard event (agent is active on Live Floor)
   - `tool_used` -> emit dashboard event (activity visible)
   - `tool_result` -> emit dashboard event (success/failure visible)
   - `text` -> forward to SSE for real-time display
   - `turn_completed` -> `RecordTurnMetrics(tokensIn, tokensOut)`, then `CheckBudget` — if exceeded, `controller.abort()` kills the session
   - `error` -> emit failure event, stop
   - `completed` -> `EvaluateOutcome` with final result
4. **After stream:** Return final content to the plugin

**What it does NOT do** (compared to old `RunAgentLoop`):
- No conversation management
- No tool execution
- No choosing between `complete` vs `completeWithTools`
- No multi-turn while loop — the `for await` over the stream IS the loop

## Section 5: RunBuildAndTest

Replaces `DeterministicProvider` + `RunAgentLoop` for the Ops agent.

**Dependencies:** `ShellExecutor`, `TaskRepository`, `RecordTurnMetrics`, `MessagePort`

**Flow:**
1. Emit `agent.active` on bus
2. Run `buildCommand` via `ShellExecutor`
   - Success -> record metrics, emit `build.passed`
   - Failure -> record metrics, emit `build.failed`, return failure
3. Run `testCommand` via `ShellExecutor`
   - Success -> record metrics, emit `test.passed`
   - Failure -> record metrics, emit `test.failed`, return failure
4. Return `{ stdout, stderr, exitCode }` for both

No AI. No fake providers. No conversation. Just shell commands.

## Section 6: Composition Root Changes

**Before:**
```
ClaudeProvider(apiKey)
  -> PromptAgent(ai, ai)
    -> RunAgentLoop(checkBudget, promptAgent, executeToolCalls, ...)
      -> passed to plugins as "executor"

DeterministicProvider([buildCmd, testCmd])
  -> PromptAgent(opsProvider, opsProvider)
    -> RunAgentLoop(checkBudget, opsPromptAgent, opsExecuteToolCalls, ...)
      -> passed to OpsPlugin

scopedExecutorFactory(worktreePath)
  -> creates scoped RunAgentLoop per worktree
```

**After:**
```
ClaudeAgentSdkAdapter()
  -> RunAgentSession(agentSession, checkBudget, recordMetrics, evaluateOutcome, taskRepo)
    -> passed to plugins as "executor"

RunBuildAndTest(shell, taskRepo, recordMetrics, bus)
  -> passed to OpsPlugin directly

No scopedExecutorFactory -- workingDir is in PhaseTask
```

**Config changes:**
- `DevFleetConfig.anthropicApiKey` -> **removed**. No API key needed.
- `DevFleetConfig.mockMode: boolean` -> **added**. Explicit flag replaces `!apiKey` inference.
- Model config fields (`developerModel`, `supervisorModel`, `reviewerModel`) -> **preserved**. Passed through `PhaseTask.model` to the adapter.
- `WorkspaceRunManager` updated to use the new config shape (no API key, uses `ClaudeAgentSdkAdapter`).

**Mock path:** When `mockMode` is true, `MockAgentSession` is wired instead of `ClaudeAgentSdkAdapter`.

## Section 7: Dashboard Impact

Zero changes to dashboard code. Same events, different source.

| Dashboard feature | Data source today | Data source after |
|---|---|---|
| Live Floor agent status | `turn_completed` AgentEvent | `started` / `completed` SessionEvent |
| Tool activity feed | `tool_executed` AgentEvent | `tool_used` + `tool_result` SessionEvent |
| Per-turn token counts | `RecordTurnMetrics` from loop | `RecordTurnMetrics` from `turn_completed` SessionEvent |
| Aggregate cost | `ComputeFinancials` from event store | Same |
| Pipeline phase flow | SupervisorPlugin bus messages | Same |
| Streaming agent text | Not implemented | New: `text` SessionEvents forwarded via SSE |

**Streaming text UI is deferred.** The engine emits the events, but the dashboard UI for displaying them is a separate deliverable after the engine change is verified.

**Financial metrics:** `total_cost_usd` from Claude Code will likely be zero on Max plan. Token counts remain meaningful for understanding agent workload.

## Dependency Changes

| Remove | Add |
|---|---|
| `@anthropic-ai/sdk` | `@anthropic-ai/claude-agent-sdk` |

## Tech Stack Notes

Identified during design review, not blocking but should be addressed:

- **SSE hardening:** Add heartbeat pings and event `id:` fields to `SSEManager`
- **TypeScript alignment:** Backend is v6, dashboard is v5.7 — align both to v6
- **`cors` dependency:** Audit whether it's still needed after SDK removal
- **CJS -> ESM migration:** Not urgent, but the backend should move to ESM eventually
