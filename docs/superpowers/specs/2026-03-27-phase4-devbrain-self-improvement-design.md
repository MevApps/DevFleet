# Phase 4: DevBrain + Self-Improvement — Design Spec

**Date:** 2026-03-27
**Status:** Draft
**Depends on:** Phase 1 (core agent), Phase 2 (full team + pipeline), Phase 3 (dashboard + real-time)
**Exit criteria:** System measurably improves its own performance over 10+ completed goals

---

## 1. Overview

Phase 4 transforms DevFleet from a system you observe into a system that improves itself. The Learner agent evolves from a passive event recorder into an active analyst that queries performance data, detects patterns, and proposes actionable recommendations. The CEO reviews and approves every recommendation before it's applied — safe lane by default, fast lane earned through trust data.

**Key principle:** The Learner never mutates prompts, skills, budgets, or models directly. It proposes. The CEO disposes.

### Deliverables

1. Structural foundation — fix 7 architectural issues from Phase 2/3
2. Tier 2 performance analytics (keep/discard ratio, cost per feature, phase durations)
3. Tier 3 strategic insights (Learner-driven recommendations)
4. CEO alerts (notification system with preferences)
5. Financials dashboard section
6. Quality dashboard section
7. Insights dashboard section
8. System Health dashboard section

### Approach

Foundation-first (Approach A). Fix all structural issues as Step 0, then build features on clean ports. No mid-phase refactoring surprises.

---

## 2. Structural Foundation (Step 0)

Seven architectural issues inherited from Phase 2/3 must be resolved before building Phase 4 features.

### 2.1 KeepDiscardRepository Port

**Problem:** KeepDiscardRecords are trapped in a raw array on LearnerPlugin (`this.keepDiscardRecords.push(record)`). No port, no repository. Data is imprisoned in Layer 3, unreachable from use cases.

**Fix:** New port in `src/use-cases/ports/KeepDiscardRepository.ts`:

```typescript
interface KeepDiscardRepository {
  save(record: KeepDiscardRecord): Promise<void>
  findByAgentId(agentId: AgentId): Promise<ReadonlyArray<KeepDiscardRecord>>
  findByGoalId(goalId: GoalId): Promise<ReadonlyArray<KeepDiscardRecord>>
  findAll(): Promise<ReadonlyArray<KeepDiscardRecord>>
}
```

`InMemoryKeepDiscardRepository` adapter replaces the raw array. LearnerPlugin receives the port via deps, calls `save()`.

### 2.2 AgentPromptStore Port

**Problem:** Prompts loaded at startup via raw `readFileSync` in the composition root. No port for runtime read/write. The Learner needs to propose prompt changes through a semantic contract.

**Fix:** New port in `src/use-cases/ports/AgentPromptStore.ts`:

```typescript
interface AgentPromptStore {
  read(role: string): Promise<string>
  update(role: string, content: string, reason: string): Promise<void>
}
```

`FileSystemAgentPromptStore` adapter reads/writes `agent-prompts/` directory. Composition root uses this port at startup instead of raw `readFileSync`.

Prompt history is not stored in sidecar files. When `update()` is called, the use case emits `agent.prompt.updated` through the bus. The event store records it — single source of truth. To query prompt history, query the event store for `agent.prompt.updated` events filtered by role.

### 2.3 Extract Aggregation from MetricsPresenter

**Problem:** `MetricsPresenter` computes total tokens, cost, agent breakdowns — business logic masquerading as formatting. Phase 4 adds more aggregations; stuffing them into a presenter creates a god class.

**Fix:** Three focused use cases, each with a single reason to change:

**`ComputeFinancials`** — `src/use-cases/ComputeFinancials.ts`
- Deps: `EventStore`, `GoalRepository`
- Computes: total token spend, total cost USD, cost per goal, agent token breakdown, model tier distribution
- Returns: `FinancialsReport` (value object)

**`ComputeQualityMetrics`** — `src/use-cases/ComputeQualityMetrics.ts`
- Deps: `KeepDiscardRepository`, `TaskRepository`
- Computes: keep/discard ratio (overall, per agent, per goal), review pass rate, top rejection reasons, recent raw records
- Returns: `QualityReport` (value object)

**`ComputePhaseTimings`** — `src/use-cases/ComputePhaseTimings.ts`
- Deps: `EventStore`, `TaskRepository`
- Computes: average duration per pipeline phase, phase stall detection, agent efficiency trend
- Returns: `TimingsReport` (value object)

`MetricsPresenter` becomes a thin formatter: calls the relevant use case, maps the report to a DTO.

Report value objects:

```typescript
interface FinancialsReport {
  readonly totalTokensUsed: number
  readonly totalCostUsd: number
  readonly costPerGoal: ReadonlyArray<{ goalId: GoalId; costUsd: number }>
  readonly agentTokenBreakdown: Record<string, number>
  readonly modelTierBreakdown: Record<string, number>
}

interface QualityReport {
  readonly overallKeepRate: number
  readonly keepRateByAgent: Record<string, number>
  readonly reviewPassRate: number
  readonly topRejectionReasons: ReadonlyArray<{ reason: string; count: number }>
  readonly recentRecords: ReadonlyArray<KeepDiscardRecord>
}

interface TimingsReport {
  readonly avgDurationByPhase: Record<string, number>
  readonly stalledPhases: ReadonlyArray<{ phase: string; avgMs: number; threshold: number }>
  readonly agentEfficiency: Record<string, number>
}
```

All three accept an optional `MetricsFilter`:

```typescript
interface MetricsFilter {
  readonly goalId?: GoalId
  readonly agentId?: AgentId
  readonly since?: Date
  readonly until?: Date
}
```

### 2.4 Reshape ExperimentResult into KeepDiscardRecord

**Problem:** `ExperimentResult` entity exists but is dead code — no repository, no use case, no adapter. Its shape (`hypothesis`/`outcome`) doesn't match the spec. Meanwhile, `KeepDiscardRecord` captures the same concept but is missing fields.

**Fix:** Delete `ExperimentResult`. Extend `KeepDiscardRecord` with the fields the spec needs:

```typescript
interface KeepDiscardRecord {
  readonly taskId: TaskId
  readonly goalId: GoalId
  readonly agentId: AgentId
  readonly phase: string
  readonly durationMs: number
  readonly tokensUsed: number
  readonly costUsd: number
  readonly verdict: "approved" | "rejected"
  readonly reasons: readonly string[]
  readonly artifactIds: readonly ArtifactId[]
  readonly commitHash: string | null
  readonly iteration: number
  readonly recordedAt: Date
}
```

One entity, one concept, one repository. Every field is populated at creation time. No nulls-by-default.

### 2.5 Learner Execution: RunAnalysisCycle

**Problem:** The Learner has no AI provider (model is `"none"`). It's a passive recorder. Phase 4 needs it to reason — pattern detection, correlation analysis, generating recommendations. `RunAgentLoop` is wrong for this — it's coupled to tasks, budgets, and turn-outcome evaluation. The Learner is an analyst, not a pipeline worker.

**Fix:** New use case `src/use-cases/RunAnalysisCycle.ts`:

```typescript
class RunAnalysisCycle {
  constructor(
    private readonly ai: AICompletionProvider,
    private readonly systemPrompt: string,
    private readonly model: string,
    private readonly computeFinancials: ComputeFinancials,
    private readonly computeQuality: ComputeQualityMetrics,
    private readonly computeTimings: ComputePhaseTimings,
    private readonly insightRepo: InsightRepository,
    private readonly notificationPort: NotificationPort,
    private readonly bus: MessagePort,
  ) {}

  async execute(): Promise<void> {
    // 1. Gather — call all three compute use cases
    // 2. Format — serialize context as structured JSON
    // 3. Reason — call AI with system prompt + context
    // 4. Parse — extract ProposedAction objects, strict validation against union schema
    // 5. Create — save Insight entities with status "pending" via InsightRepository
    // 6. Notify — emit insight.generated through bus, push CeoAlert for high-confidence insights
  }
}
```

Nine dependencies. Each used for exactly one purpose. System prompt and model injected at construction time, not per-call. The three compute use cases provide all the data — no reaching around them.

### 2.6 NotificationPort

**Problem:** No concept of pushing alerts to the CEO outside of the SSE event firehose. Alerts are filtered, severity-tagged, preference-checked — different from raw events.

**Fix:** New port in `src/use-cases/ports/NotificationPort.ts`:

```typescript
interface CeoAlert {
  readonly severity: "info" | "warning" | "urgent"
  readonly title: string
  readonly body: string
  readonly goalId?: GoalId
  readonly taskId?: TaskId
  readonly insightId?: InsightId
}

interface NotificationPort {
  notify(alert: CeoAlert): Promise<void>
}
```

V1 adapter: `NoOpNotificationAdapter` — SSE delivery is handled by the bus → SSEManager path. `NotificationPort` exists for future out-of-band channels (Slack, email, webhook). The port is the correct abstraction; the first adapter is honest that no external channel exists yet.

### 2.7 Insight Entity + Repository

**Problem:** No entity for Learner recommendations. No lifecycle for propose → review → accept/dismiss. No typed representation of what the Learner wants to change.

**Fix:** New entity `src/entities/Insight.ts`:

```typescript
type ProposedAction =
  | { readonly kind: "prompt_update"; readonly role: string;
      readonly currentContent: string; readonly newContent: string }
  | { readonly kind: "budget_tune"; readonly role: string;
      readonly currentMaxTokens: number; readonly currentMaxCostUsd: number;
      readonly newMaxTokens: number; readonly newMaxCostUsd: number }
  | { readonly kind: "model_reassign"; readonly role: string;
      readonly currentModel: string; readonly newModel: string }
  | { readonly kind: "skill_update"; readonly skillName: string;
      readonly currentContent: string; readonly newContent: string }
  | { readonly kind: "process_change"; readonly description: string }

interface Insight {
  readonly id: InsightId
  readonly title: string
  readonly description: string
  readonly evidence: string
  readonly proposedAction: ProposedAction
  readonly status: "pending" | "applied" | "dismissed"
  readonly outcomeMetric: number | null
  readonly createdAt: Date
  readonly resolvedAt: Date | null
}
```

Status lifecycle: `pending` → `applied` (CEO accepted and system applied) or `pending` → `dismissed`. No intermediate "accepted" state — V1 applies immediately on accept. If future phases need async/fallible apply, add the state then.

Every actionable variant carries both `current` and `new` values — snapshots frozen at insight creation time by `RunAnalysisCycle`. The dashboard renders diffs from the snapshot without extra API calls.

New port `src/use-cases/ports/InsightRepository.ts`:

```typescript
interface InsightRepository {
  save(insight: Insight): Promise<void>
  findById(id: InsightId): Promise<Insight | null>
  findByStatus(status: Insight["status"]): Promise<ReadonlyArray<Insight>>
  findAll(): Promise<ReadonlyArray<Insight>>
  update(insight: Insight): Promise<void>
}
```

`InMemoryInsightRepository` adapter.

---

## 3. Tier 2 Analytics + Learner Reasoning Engine

### 3.1 New Ports for AcceptInsight Dispatch

Every mutation `AcceptInsight` can perform needs a port — no fire-and-forget messages pretending to be actions.

**`BudgetConfigStore`** — `src/use-cases/ports/BudgetConfigStore.ts`:

```typescript
interface BudgetDefaults {
  readonly role: string
  readonly maxTokens: number
  readonly maxCostUsd: number
}

interface BudgetConfigStore {
  read(role: string): Promise<BudgetDefaults>
  update(role: string, maxTokens: number, maxCostUsd: number): Promise<void>
}
```

`InMemoryBudgetConfigStore` adapter, initialized from `DevFleetConfig` at startup. Supervisor queries this port when allocating budgets to new tasks.

**`SkillStore`** — `src/use-cases/ports/SkillStore.ts`:

```typescript
interface SkillStore {
  read(skillName: string): Promise<string>
  update(skillName: string, content: string, reason: string): Promise<void>
  list(): Promise<ReadonlyArray<string>>
}
```

`FileSystemSkillStore` adapter, same pattern as `AgentPromptStore`.

**`AgentRegistry` extension** — add to existing port:

```typescript
updateModel(agentId: AgentId, model: string): Promise<void>
```

The in-memory adapter creates a new immutable `Agent` value object with the updated model and replaces the old entry.

### 3.2 Learner System Prompt

New file `agent-prompts/learner.md`. The prompt instructs the Learner to:

- Receive structured metrics data (financials, quality, timings) as JSON context
- Identify patterns (repeated rejection reasons, cost trends, phase bottlenecks)
- Produce zero or more recommendations as structured JSON matching the `ProposedAction` union
- Include evidence for each recommendation (which metrics, what trend, confidence level)
- Stay conservative — only recommend changes with clear supporting data

The Learner is an auditor, not a creative. The prompt enforces that tone.

### 3.3 QualityReport Includes Raw Records

`ComputeQualityMetrics` returns raw recent records alongside aggregations so the Learner AI gets both trends and specific examples:

```typescript
interface QualityReport {
  readonly overallKeepRate: number
  readonly keepRateByAgent: Record<string, number>
  readonly reviewPassRate: number
  readonly topRejectionReasons: ReadonlyArray<{ reason: string; count: number }>
  readonly recentRecords: ReadonlyArray<KeepDiscardRecord>
}
```

"Rejection rate is 40%" tells the trend. "Last 3 rejections were all for missing error handling" tells the story. The AI needs both.

### 3.4 Learner Trigger Points

LearnerPlugin gains two trigger mechanisms:

**Event-driven:** When `goal.completed` arrives, the Learner calls `this.analysisCycle.execute()`. One analysis per completed goal — goals are the natural unit because they represent a full pipeline cycle.

**Periodic sweep:** The composition root sets a configurable interval (default 1 hour). If no goal has completed in that window, run analysis anyway to catch slow-burn trends. The interval handle is captured and cleared on `stop()`, same pattern as `DetectStuckAgent`.

### 3.5 AcceptInsight Use Case

Port first, message second. Apply first, broadcast second.

```typescript
class AcceptInsight {
  constructor(
    private readonly insightRepo: InsightRepository,
    private readonly promptStore: AgentPromptStore,
    private readonly budgetConfigStore: BudgetConfigStore,
    private readonly agentRegistry: AgentRegistry,
    private readonly skillStore: SkillStore,
    private readonly bus: MessagePort,
    private readonly notificationPort: NotificationPort,
  ) {}

  async execute(insightId: InsightId): Promise<void> {
    // 1. Load insight, verify status is "pending"
    // 2. Apply via port — dispatch on proposedAction.kind:
    //    - prompt_update  → promptStore.update(role, newContent, reason)
    //    - budget_tune    → budgetConfigStore.update(role, newMaxTokens, newMaxCostUsd)
    //    - model_reassign → agentRegistry.updateModel(agentId, newModel)
    //    - skill_update   → skillStore.update(skillName, newContent, reason)
    //    - process_change → no-op (advisory, logged)
    // 3. Update insight status to "applied", set resolvedAt
    // 4. Emit audit message through bus (agent.prompt.updated, budget.updated,
    //    model.updated, skill.updated — audit-only, not coordination signals)
    // 5. Notify CEO: "Insight applied: {title}"
  }
}
```

### 3.6 DismissInsight Use Case

```typescript
class DismissInsight {
  constructor(
    private readonly insightRepo: InsightRepository,
  ) {}

  async execute(insightId: InsightId): Promise<void> {
    // 1. Load insight, verify status is "pending"
    // 2. Update status to "dismissed", set resolvedAt
  }
}
```

Dismissed insights are kept permanently. The Learner can observe dismissal patterns on future cycles.

### 3.7 New Message Types

Add to the `Message` union in `src/entities/Message.ts`:

- `insight.generated` — carries `insightId`, `actionKind`, `title`
- `insight.accepted` — carries `insightId`, `actionKind`, `title`
- `insight.dismissed` — carries `insightId`
- `budget.updated` — carries `role`, new budget values — **audit-only**
- `model.updated` — carries `role`, new model — **audit-only**
- `ceo.alert` — carries `CeoAlert` payload

All audit-only messages. Actual mutations happen through ports in `AcceptInsight`. These messages flow through the bus into the event store as receipts and via SSEManager to the dashboard. No component subscribes to these to trigger behavior.

### 3.8 API Routes

**`insightRoutes.ts`** — new file in `src/infrastructure/http/routes/`:

- `GET /api/insights` — returns `InsightSummaryDTO[]`, filterable by `status` query param
- `GET /api/insights/:id` — returns `InsightDetailDTO` with full `ProposedAction` (including snapshots)
- `POST /api/insights/:id/accept` — triggers `AcceptInsight`
- `POST /api/insights/:id/dismiss` — triggers `DismissInsight`

**Updated `metricsRoutes.ts`:**

- `GET /api/metrics/financials` — calls `ComputeFinancials`, returns `FinancialsDTO`
- `GET /api/metrics/quality` — calls `ComputeQualityMetrics`, returns `QualityDTO`
- `GET /api/metrics/timings` — calls `ComputePhaseTimings`, returns `TimingsDTO`
- `GET /api/metrics` — backward compat, calls all three via presenter

All routes accept optional query params `goalId`, `agentId`, `since`, `until` matching `MetricsFilter`.

### 3.9 DTOs

Two insight DTOs — list is lightweight, detail is complete:

```typescript
interface InsightSummaryDTO {
  readonly id: string
  readonly title: string
  readonly actionKind: string
  readonly status: string
  readonly createdAt: string
}

interface InsightDetailDTO {
  readonly id: string
  readonly title: string
  readonly description: string
  readonly evidence: string
  readonly proposedAction: ProposedAction
  readonly status: string
  readonly createdAt: string
  readonly resolvedAt: string | null
}
```

Metrics DTOs:

```typescript
interface FinancialsDTO {
  readonly totalTokensUsed: number
  readonly totalCostUsd: number
  readonly costPerGoal: ReadonlyArray<{ goalId: string; costUsd: number }>
  readonly agentTokenBreakdown: Record<string, number>
  readonly modelTierBreakdown: Record<string, number>
}

interface QualityDTO {
  readonly overallKeepRate: number
  readonly keepRateByAgent: Record<string, number>
  readonly reviewPassRate: number
  readonly topRejectionReasons: ReadonlyArray<{ reason: string; count: number }>
}

interface TimingsDTO {
  readonly avgDurationByPhase: Record<string, number>
  readonly stalledPhases: ReadonlyArray<{ phase: string; avgMs: number; threshold: number }>
  readonly agentEfficiency: Record<string, number>
}
```

---

## 4. CEO Alerts + Notification System

### 4.1 Extract Event Persistence from LearnerPlugin

**Problem:** Event persistence is a side effect of the Learner agent via `recordSystemEvent()`. The Learner only subscribes to specific message types, so new types (like `ceo.alert`) aren't persisted. Event recording shouldn't be the Learner's job.

**Fix:** Dedicated bus subscriber in the composition root:

```typescript
bus.subscribe({}, async (message) => {
  await eventStore.append(toSystemEvent(message))
})
```

Helper function `toSystemEvent(message: Message): SystemEvent` extracts `agentId`, `taskId`, `goalId`, and `cost` from message payloads.

Remove `recordSystemEvent()` from LearnerPlugin. Remove `eventStore` from `LearnerPluginDeps`. Every message type — existing and future — is automatically persisted. No manual subscription lists.

### 4.2 Alert Rules Engine

Use case `src/use-cases/EvaluateAlert.ts`:

```typescript
interface AlertRule {
  readonly trigger: MessageType
  readonly severity: "info" | "warning" | "urgent"
  readonly evaluate: (message: Message) => CeoAlert | null
}

class EvaluateAlert {
  constructor(
    private readonly notificationPort: NotificationPort,
    private readonly alertPreferencesStore: AlertPreferencesStore,
    private readonly bus: MessagePort,
    private readonly rules: ReadonlyArray<AlertRule>,
  ) {}

  async execute(message: Message): Promise<void> {
    const prefs = await this.alertPreferencesStore.read()

    for (const rule of this.rules) {
      if (rule.trigger !== message.type) continue
      const alert = rule.evaluate(message)
      if (!alert) continue
      if (severityRank(alert.severity) < severityRank(prefs.minSeverity)) continue
      if (prefs.mutedTriggers.includes(rule.trigger)) continue

      // Bus for internal delivery (persistence + SSE)
      this.bus.emit({ type: "ceo.alert", ...alert })

      // Port for external delivery (future: Slack, email, webhook)
      await this.notificationPort.notify(alert)
    }
  }
}
```

### 4.3 Alert Rules

Defined as pure data in the composition root. Adding a rule = adding one array entry.

| Trigger | Severity | Condition |
|---------|----------|-----------|
| `goal.completed` | info | Always |
| `agent.stuck` | warning | Always |
| `budget.exceeded` | warning | Always |
| `review.rejected` | urgent | Only when `iteration >= 3` (rejection loop) |
| `insight.generated` | info | Always |
| `insight.accepted` | info | Always |

### 4.4 Alert Subscription Wiring

```typescript
const evaluateAlert = new EvaluateAlert(notificationPort, alertPreferencesStore, bus, alertRules)

bus.subscribe(
  { types: alertRules.map(r => r.trigger) },
  (message) => evaluateAlert.execute(message),
)
```

Subscription list derived from the rules array — no manual sync.

### 4.5 Alert Preferences

Entity `src/entities/AlertPreferences.ts`:

```typescript
interface AlertPreferences {
  readonly minSeverity: "info" | "warning" | "urgent"
  readonly mutedTriggers: ReadonlyArray<MessageType>
}
```

Port `src/use-cases/ports/AlertPreferencesStore.ts`:

```typescript
interface AlertPreferencesStore {
  read(): Promise<AlertPreferences>
  update(prefs: AlertPreferences): Promise<void>
}
```

`InMemoryAlertPreferencesStore` adapter. Defaults: `minSeverity: "info"`, `mutedTriggers: []`.

### 4.6 Alert API Routes

**`alertRoutes.ts`** — new file in `src/infrastructure/http/routes/`:

- `GET /api/alerts` — queries event store for recent `ceo.alert` events, returns `CeoAlertDTO[]`
- `GET /api/alerts/preferences` — returns current preferences
- `PUT /api/alerts/preferences` — updates preferences

No separate alert storage. Alerts are events. Query the event store.

### 4.7 Alert DTOs

```typescript
interface CeoAlertDTO {
  readonly severity: "info" | "warning" | "urgent"
  readonly title: string
  readonly body: string
  readonly goalId: string | null
  readonly taskId: string | null
  readonly insightId: string | null
  readonly timestamp: string
}

interface AlertPreferencesDTO {
  readonly minSeverity: "info" | "warning" | "urgent"
  readonly mutedTriggers: ReadonlyArray<string>
}
```

---

## 5. Dashboard

### 5.1 DashboardDeps Extension

```typescript
interface DashboardDeps {
  // ...existing fields...
  readonly pluginRegistry: PluginRegistry
  readonly acceptInsight: AcceptInsight
  readonly dismissInsight: DismissInsight
  readonly computeFinancials: ComputeFinancials
  readonly computeQuality: ComputeQualityMetrics
  readonly computeTimings: ComputePhaseTimings
  readonly alertPreferencesStore: AlertPreferencesStore
  readonly insightRepo: InsightRepository
}
```

### 5.2 Navigation Update

Update `dashboard/src/app/layout.tsx`:

- Live Floor (`/`) — existing
- Pipeline (`/pipeline`) — existing
- Financials (`/financials`) — new
- Quality (`/quality`) — new
- Insights (`/insights`) — new
- System Health (`/system`) — new
- Alerts drawer — bell icon in nav bar, persistent across all pages

### 5.3 Financials Page

Route: `dashboard/src/app/financials/page.tsx`
Components: `dashboard/src/components/financials/`

| Component | Purpose | Data |
|-----------|---------|------|
| `cost-overview.tsx` | Total tokens, total cost, avg cost per goal | `FinancialsDTO` top-level fields |
| `cost-per-goal-chart.tsx` | Bar chart of cost per completed goal | `costPerGoal` |
| `agent-spend-breakdown.tsx` | Horizontal bar of tokens per agent | `agentTokenBreakdown` |
| `model-tier-breakdown.tsx` | Donut chart of spend by model tier | `modelTierBreakdown` |

Shared filter bar at top accepts `MetricsFilter` (goalId, since, until).

### 5.4 Quality Page

Route: `dashboard/src/app/quality/page.tsx`
Components: `dashboard/src/components/quality/`

| Component | Purpose | Data |
|-----------|---------|------|
| `keep-rate-overview.tsx` | Large % display, color-coded (green/yellow/red) | `overallKeepRate` |
| `keep-rate-by-agent.tsx` | Bar chart per agent | `keepRateByAgent` |
| `review-pass-rate.tsx` | First-attempt approval % | `reviewPassRate` |
| `rejection-reasons.tsx` | Ranked list with counts | `topRejectionReasons` |

### 5.5 Insights Page

Route: `dashboard/src/app/insights/page.tsx`
Components: `dashboard/src/components/insights/`

**`insights-list.tsx`** — Filterable card list. Tabs: Pending | Applied | Dismissed. Each card: title, action kind badge, created date.

**`insight-detail.tsx`** — Expanded view on card click:

- Title, description, evidence
- Proposed action rendered by kind using snapshot data:
  - `prompt_update` — side-by-side diff of `currentContent` vs `newContent`
  - `budget_tune` — table of current vs proposed values
  - `model_reassign` — current model vs proposed model
  - `skill_update` — side-by-side diff of `currentContent` vs `newContent`
  - `process_change` — description text (advisory, no action buttons)
- Action buttons: **Accept** and **Dismiss** (for actionable kinds only)

**`insight-history.tsx`** — Table of applied/dismissed insights with timestamps and `outcomeMetric` (null for V1).

### 5.6 System Health Page

Route: `dashboard/src/app/system/page.tsx`
Components: `dashboard/src/components/system/`

| Component | Purpose | Data Source |
|-----------|---------|-------------|
| `agent-status-grid.tsx` | All agents: role, status, model, last active | `GET /api/agents` |
| `prompt-versions.tsx` | Prompt status per role, diff on click | `GET /api/events?type=agent.prompt.updated` |
| `plugin-status.tsx` | Plugin health status | `GET /api/system/health` |
| `phase-timings.tsx` | Avg duration per phase, stall highlights | `GET /api/metrics/timings` |

### 5.7 Alerts Drawer

Persistent slide-out drawer, bell icon in nav. Not a separate page.

Component: `dashboard/src/components/alerts/alerts-drawer.tsx`

- Recent `ceo.alert` events from `GET /api/alerts`
- Real-time via SSE — new alerts append to top
- Unread count badge, resets on drawer open
- Severity colors: info (blue), warning (yellow), urgent (red)
- Links to context: goalId → Pipeline, insightId → Insights, taskId → Pipeline
- Settings button → preferences modal (min severity, muted triggers)
- Preferences saved via `PUT /api/alerts/preferences`

### 5.8 System Health Route

**`systemRoutes.ts`** — `src/infrastructure/http/routes/`:

- `GET /api/system/health` — calls `healthCheck()` on each plugin via `PluginRegistry`, returns `PluginHealthDTO[]`

### 5.9 Dashboard Types

Update `dashboard/src/lib/types.ts`:

```typescript
interface FinancialsData {
  totalTokensUsed: number
  totalCostUsd: number
  costPerGoal: Array<{ goalId: string; costUsd: number }>
  agentTokenBreakdown: Record<string, number>
  modelTierBreakdown: Record<string, number>
}

interface QualityData {
  overallKeepRate: number
  keepRateByAgent: Record<string, number>
  reviewPassRate: number
  topRejectionReasons: Array<{ reason: string; count: number }>
}

interface TimingsData {
  avgDurationByPhase: Record<string, number>
  stalledPhases: Array<{ phase: string; avgMs: number; threshold: number }>
  agentEfficiency: Record<string, number>
}

interface InsightSummary {
  id: string
  title: string
  actionKind: string
  status: string
  createdAt: string
}

interface InsightDetail {
  id: string
  title: string
  description: string
  evidence: string
  proposedAction: ProposedAction
  status: string
  createdAt: string
  resolvedAt: string | null
}

interface CeoAlert {
  severity: "info" | "warning" | "urgent"
  title: string
  body: string
  goalId: string | null
  taskId: string | null
  insightId: string | null
  timestamp: string
}

interface AlertPreferences {
  minSeverity: "info" | "warning" | "urgent"
  mutedTriggers: string[]
}

interface PluginHealth {
  name: string
  status: "healthy" | "degraded" | "unhealthy"
}
```

### 5.10 Dashboard API Client

Update `dashboard/src/lib/api.ts`:

```typescript
// Metrics
getFinancials(filter?: MetricsFilter): Promise<FinancialsData>
getQuality(filter?: MetricsFilter): Promise<QualityData>
getTimings(filter?: MetricsFilter): Promise<TimingsData>

// Insights
getInsights(status?: string): Promise<InsightSummary[]>
getInsight(id: string): Promise<InsightDetail>
acceptInsight(id: string): Promise<void>
dismissInsight(id: string): Promise<void>

// Alerts
getAlerts(): Promise<CeoAlert[]>
getAlertPreferences(): Promise<AlertPreferences>
updateAlertPreferences(prefs: AlertPreferences): Promise<void>

// System
getSystemHealth(): Promise<PluginHealth[]>
```

### 5.11 Zustand Store Updates

Update `dashboard/src/lib/store.ts`:

- `alerts: CeoAlert[]` — populated from SSE `ceo.alert` events
- `unreadAlertCount: number` — increments on new alert, resets on drawer open
- `insightsPending: InsightSummary[]` — refreshed on `insight.generated` SSE event

Page-scoped data (financials, quality, timings, system health) uses local component state with `useEffect`. Only cross-page state belongs in the global store.

---

## 6. Composition Root Changes

Summary of all wiring changes in `src/infrastructure/config/composition-root.ts`:

### New Storage Adapters
- `InMemoryKeepDiscardRepository`
- `InMemoryInsightRepository`
- `InMemoryBudgetConfigStore` (initialized from `DevFleetConfig`)
- `InMemoryAlertPreferencesStore` (initialized with defaults)

### New Infrastructure Adapters
- `FileSystemAgentPromptStore` (replaces raw `loadPrompt()`)
- `FileSystemSkillStore`
- `NoOpNotificationAdapter`

### New Use Cases
- `ComputeFinancials`
- `ComputeQualityMetrics`
- `ComputePhaseTimings`
- `RunAnalysisCycle` (Learner's brain)
- `AcceptInsight`
- `DismissInsight`
- `EvaluateAlert`

### Wiring Changes
- **Event persistence:** Universal bus subscriber replaces `LearnerPlugin.recordSystemEvent()`
- **LearnerPlugin:** Gains `RunAnalysisCycle`, `KeepDiscardRepository`. Loses `EventStore`. Model changes from `"none"` to Opus.
- **Alert subscription:** Derived from alert rules array
- **Learner sweep interval:** Configurable periodic analysis (default 1 hour)
- **DashboardDeps:** Extended with new use cases, ports, and `PluginRegistry`
- **AgentPromptStore:** Used at startup to load prompts (replaces `loadPrompt()`)

### AgentRegistry Port Extension
- Add `updateModel(agentId, model)` to existing interface

---

## 7. Testing Strategy

### Unit Tests (per component)
- Each compute use case: given events/records → correct report values
- `AcceptInsight`: dispatch on each `ProposedAction.kind` → correct port called
- `DismissInsight`: status transitions
- `EvaluateAlert`: rule matching, preference filtering, severity ordering
- `RunAnalysisCycle`: mock AI response → correct Insight entities created
- All new adapters: `InMemoryKeepDiscardRepository`, `InMemoryInsightRepository`, etc.

### Integration Tests
- Full insight lifecycle: RunAnalysisCycle creates insight → API returns it → accept → port mutated → audit event in store
- Alert flow: trigger event → rule matches → preferences checked → ceo.alert in event store
- Metrics pipeline: create goals/tasks/records → compute use cases return correct aggregations
- Dashboard API: each new endpoint returns correct DTO shape

### Existing Test Compatibility
- `GET /api/metrics` backward compat endpoint returns same shape as before
- LearnerPlugin still handles `review.approved`/`review.rejected` (writes to KeepDiscardRepository instead of raw array)

---

## 8. File Inventory

### New Files — Layer 1 (Entities)
- `src/entities/Insight.ts` — Insight entity + ProposedAction union
- `src/entities/AlertPreferences.ts` — Alert preferences entity

### New Files — Layer 2 (Use Cases / Ports)
- `src/use-cases/ports/KeepDiscardRepository.ts`
- `src/use-cases/ports/AgentPromptStore.ts`
- `src/use-cases/ports/InsightRepository.ts`
- `src/use-cases/ports/BudgetConfigStore.ts`
- `src/use-cases/ports/SkillStore.ts`
- `src/use-cases/ports/NotificationPort.ts`
- `src/use-cases/ports/AlertPreferencesStore.ts`
- `src/use-cases/ComputeFinancials.ts`
- `src/use-cases/ComputeQualityMetrics.ts`
- `src/use-cases/ComputePhaseTimings.ts`
- `src/use-cases/RunAnalysisCycle.ts`
- `src/use-cases/AcceptInsight.ts`
- `src/use-cases/DismissInsight.ts`
- `src/use-cases/EvaluateAlert.ts`

### New Files — Layer 3 (Adapters)
- `src/adapters/storage/InMemoryKeepDiscardRepository.ts`
- `src/adapters/storage/InMemoryInsightRepository.ts`
- `src/adapters/storage/InMemoryBudgetConfigStore.ts`
- `src/adapters/storage/InMemoryAlertPreferencesStore.ts`
- `src/adapters/filesystem/FileSystemAgentPromptStore.ts`
- `src/adapters/filesystem/FileSystemSkillStore.ts`
- `src/adapters/notifications/NoOpNotificationAdapter.ts`

### New Files — Layer 3 (HTTP Routes)
- `src/infrastructure/http/routes/insightRoutes.ts`
- `src/infrastructure/http/routes/alertRoutes.ts`
- `src/infrastructure/http/routes/systemRoutes.ts`

### New Files — Dashboard
- `dashboard/src/app/financials/page.tsx`
- `dashboard/src/app/quality/page.tsx`
- `dashboard/src/app/insights/page.tsx`
- `dashboard/src/app/system/page.tsx`
- `dashboard/src/components/financials/cost-overview.tsx`
- `dashboard/src/components/financials/cost-per-goal-chart.tsx`
- `dashboard/src/components/financials/agent-spend-breakdown.tsx`
- `dashboard/src/components/financials/model-tier-breakdown.tsx`
- `dashboard/src/components/quality/keep-rate-overview.tsx`
- `dashboard/src/components/quality/keep-rate-by-agent.tsx`
- `dashboard/src/components/quality/review-pass-rate.tsx`
- `dashboard/src/components/quality/rejection-reasons.tsx`
- `dashboard/src/components/insights/insights-list.tsx`
- `dashboard/src/components/insights/insight-detail.tsx`
- `dashboard/src/components/insights/insight-history.tsx`
- `dashboard/src/components/system/agent-status-grid.tsx`
- `dashboard/src/components/system/prompt-versions.tsx`
- `dashboard/src/components/system/plugin-status.tsx`
- `dashboard/src/components/system/phase-timings.tsx`
- `dashboard/src/components/alerts/alerts-drawer.tsx`

### New Files — Agent Prompts
- `agent-prompts/learner.md`

### Modified Files
- `src/entities/KeepDiscardRecord.ts` — add goalId, costUsd, iteration
- `src/entities/Message.ts` — add 6 new message types
- `src/entities/ids.ts` — add InsightId
- `src/use-cases/ports/AgentRegistry.ts` — add updateModel()
- `src/adapters/plugins/agents/LearnerPlugin.ts` — remove recordSystemEvent, add RunAnalysisCycle, use KeepDiscardRepository
- `src/adapters/presenters/MetricsPresenter.ts` — gut to thin wrapper over compute use cases
- `src/adapters/presenters/dto.ts` — add all new DTOs
- `src/infrastructure/config/composition-root.ts` — full Phase 4 wiring
- `src/infrastructure/http/createServer.ts` — extend DashboardDeps, mount new routes
- `src/infrastructure/http/routes/metricsRoutes.ts` — add focused endpoints
- `dashboard/src/app/layout.tsx` — nav update
- `dashboard/src/lib/types.ts` — mirror new DTOs
- `dashboard/src/lib/api.ts` — new fetch functions
- `dashboard/src/lib/store.ts` — alerts state, unread count

### Deleted Files
- `src/entities/ExperimentResult.ts`
