# Sheldon — AI Company Orchestration Platform

**Date:** 2026-04-03
**Status:** Design approved
**Replaces:** DevFleet (fresh repo, not evolution)
**Reference:** Paperclip AI (github.com/paperclipai/paperclip)

## Vision

Sheldon is a self-hosted control plane that orchestrates teams of AI agents organized as virtual companies. The human acts as the Board (governance layer) while AI agents do the work. Named after Sheldon Cooper — the ultimate orchestrator who creates governance contracts, assigns roles, reviews everyone's work, and enforces protocols.

**Differentiation from Paperclip:**
- **Learning system** — agents improve over time via structured feedback loops
- **90-second onboarding** — goal-first, zero config, CEO agent drives setup
- **Mission Control UI** — 7 pages vs 30+, Norman/Nielsen driven, SSE live streaming
- **Inspector panels** — contextual detail without page navigation

## Decisions Log

| Decision | Choice | Rationale |
|---|---|---|
| Scope | General-purpose company orchestration (not dev-only) | Match and exceed Paperclip |
| Multi-tenancy | Multi-company from day one | Full data isolation per company |
| Adapters | Claude Code at launch, interface supports all | Ship focused, expand later |
| Database | PostgreSQL + PGlite + Drizzle ORM | Zero-config local, real Postgres prod |
| Auth | Better Auth (local_trusted + authenticated modes) | OAuth plugins available for future |
| Communication | Issues and comments only (no event bus for agents) | Auditable, single communication channel |
| Orchestration | Heartbeat model (wake/sleep cycles) | Agents don't run continuously |
| Governance | Full — configurable approval gates, system-calculated risk | Board controls everything |
| Plugins | Full SDK with definePlugin(), UI hooks, background jobs | Third-party extensibility |
| Deployment | Self-hosted only | Users run their own instance |
| Migration | Fresh repo (not evolving DevFleet) | Saves ~30-40% tokens, cleaner result |
| Name | Sheldon (The Big Bang Theory) | Governance, orchestration, universal recognition |

---

## 1. Project Structure

```
sheldon/
├── packages/
│   ├── domain/            # Entities, ports, use-cases — ZERO framework dependencies
│   │   └── src/
│   │       ├── entities/        # Company, Agent, Issue, Goal, Learning, etc.
│   │       ├── ports/           # AgentExecutor, SessionCodec, UsageParser, etc.
│   │       ├── use-cases/       # Business logic, returns Result<T, E>
│   │       └── errors.ts        # Typed domain errors
│   ├── db/                # Drizzle schema, migrations, PGlite embed
│   ├── server/            # Express 5 REST routes + SSE streams — thin controllers
│   │   └── src/
│   │       ├── routes/          # One file per use-case (checkout-issue.ts, post-comment.ts)
│   │       └── streams/         # SSE handlers (separate from REST)
│   ├── services/          # Heartbeat engine, plugin runtime — depends on domain
│   ├── ui/                # React 19 + Vite dashboard
│   ├── cli/               # `sheldon` CLI
│   ├── shared/            # Types, validators, API paths, PluginEventMap
│   ├── adapters/
│   │   ├── storage/       # Drizzle implementations of domain repository ports
│   │   └── claude-local/  # First agent adapter
│   └── plugins/
│       ├── sdk/           # definePlugin(), extension factories
│       └── examples/
├── skills/                # Agent skill definitions
├── docs/
├── package.json           # pnpm workspace root
└── pnpm-workspace.yaml
```

**Package dependency rule:** `domain` imports nothing. `server`, `services`, `adapters` depend on `domain`. `server` and `services` never import each other. `adapters` never import `server`. Dependencies always point inward toward the domain.

### Tech Stack

| Layer | Choice |
|---|---|
| Monorepo | pnpm workspaces |
| Backend | Express 5 + TypeScript |
| Database | PostgreSQL + PGlite + Drizzle ORM |
| Frontend | React 19 + Vite + TanStack Query + Radix UI + Tailwind 4 |
| Auth | Better Auth |
| Real-time | SSE (Server-Sent Events) |
| Testing | Vitest + Playwright |
| CLI | Commander.js + tsx |

### Testing Strategy

**Unit tests (Vitest) — domain package:**
- Entities and use-cases — pure logic, no mocks needed, no I/O
- Use-cases receive port interfaces, tests provide simple in-memory fakes
- Every use-case returns `Result<T, E>` — test both ok and error paths

**Integration tests (Vitest + PGlite) — server + services packages:**
- API routes → use-cases → real database (PGlite in-process, no Docker)
- Heartbeat lifecycle with mock adapter (fake AgentExecutor that returns canned results)
- Approval flow end-to-end through the service layer
- SSE event emission on state changes
- Do NOT mock the database — PGlite makes real DB tests as fast as mocked ones

**E2E tests (Playwright) — ui package:**
- Onboarding flow → Mission Control renders
- Inspector panel open/close, tab switching
- Approval approve/deny/undo cycle
- Company switcher

**Test boundaries:** Unit tests cover domain logic. Integration tests cover the wiring between packages. E2E tests cover user-visible workflows. If a bug can be caught by a unit test, don't write an integration test for it.

---

## 2. Data Model

### Core Entities

| Entity | Purpose |
|---|---|
| `companies` | Top-level tenant, everything scoped here |
| `agents` | AI worker — adapter type, org position (parentAgentId), budget, status |
| `goals` | Company-level objectives, decomposed into projects/issues |
| `projects` | Groups of related issues, workspace config (git repo, branch strategy) |
| `issues` | Unit of work — status lifecycle, single-assignee checkout, comments, documents |
| `issue_comments` | Agent-to-agent and Board-to-agent communication |
| `documents` | Plans, specs attached to issues, with revision history |
| `document_revisions` | Version history per document |
| `heartbeat_runs` | Execution log per agent wake cycle — stdout, token usage, cost |
| `approvals` | Governance gates — configurable policy, system-calculated risk |
| `budget_policies` | Monthly per-agent spend limits in cents, auto-pause at 100% |
| `cost_events` | Every token spend recorded, rolls up to agent/project/company |
| `activity_log` | Audit trail — every mutation logged |
| `routines` | Recurring tasks — cron or webhook triggered |
| `work_products` | PRs, branches, artifacts produced by agent runs |
| `execution_workspaces` | Managed sandbox environments per task |
| `company_secrets` | Encrypted vault per company |
| `company_secret_versions` | Secret versioning |
| `company_skills` | Skill library per company |
| `plugins` | Installed plugins with config and state |

### Sheldon-Exclusive Entities (Not in Paperclip)

| Entity | Purpose |
|---|---|
| `learnings` | What agents learned from outcomes — domain, tags, confidence, source issue/run |
| `learning_applications` | When a learning was applied and whether it helped — feedback loop |
| `company_templates` | Exportable company snapshots for quick-start onboarding |

### Issue Status Lifecycle

```
backlog → todo → in_progress → in_review → done
                     ↓
                  blocked → cancelled
```

**Atomic checkout:** `POST /api/companies/:id/issues/:id/checkout` — single-assignee, 409 Conflict on contention.

---

## 3. Heartbeat System

Agents don't run continuously. They wake for short execution windows triggered by:

| Trigger | When |
|---|---|
| Assignment | New issue assigned to agent |
| Schedule | Cron timer fires (routines) |
| Mention | @-mention in a comment |
| Manual | Board clicks "Invoke" |
| Approval resolution | Pending approval granted/denied |

### Heartbeat Lifecycle

```
1. Trigger fires
2. Budget check → skip if exhausted, notify Board
3. Queue run (per-agent concurrency limit = 1)
4. Prepare execution context:
   - Resolve execution workspace (git worktree or project dir)
   - Load agent skills from company library
   - Enrich context via ContextEnricher port (injects learnings)
   - Build system prompt (identity + skills + assignments + learnings)
   - Generate short-lived JWT for API access
5. Spawn adapter (Claude Code CLI):
   - Inject env vars: SHELDON_AGENT_ID, SHELDON_API_KEY, SHELDON_RUN_ID, SHELDON_API_URL
   - Pass system prompt + task context
   - Capture stdout/stderr
6. Agent runs — calls Sheldon REST API:
   - GET /issues?assignee=me&status=todo
   - POST /issues/:id/checkout (409 on conflict)
   - GET/POST /issues/:id/comments
   - PATCH /issues/:id (status updates)
   - POST /issues (create child issues for delegation)
7. Agent exits (or max turn limit)
8. Post-run processing:
   - Parse token usage/cost from stdout
   - Record cost_event
   - Save session state (for resumption next heartbeat)
   - Record heartbeat_run with full log
   - Redact sensitive data from logs
   - Emit run.completed domain event
9. Reap workspace if temporary
```

### Session Persistence

Adapter provides a `SessionCodec` — serializes conversation state after each run, restores on next heartbeat. Agent picks up where it left off.

### Session Compaction

Auto-prunes conversation history when sessions exceed thresholds:
- Max 200 turns
- Max 2M input tokens
- Max 72 hours
- Three-tier policy: agent override > adapter default > system fallback

---

## 4. Adapter System (Clean Architecture)

### Domain Ports (ISP-compliant)

```typescript
// domain/ports/AgentExecutor.ts
interface AgentExecutor {
  execute(config: ExecutionConfig): Promise<RunResult>
}

// domain/ports/SessionCodec.ts
interface SessionCodec {
  serialize(state: SessionState): Buffer
  deserialize(data: Buffer): SessionState
}

// domain/ports/UsageParser.ts
interface UsageParser {
  parseUsage(stdout: string): TokenUsage | null
}

// domain/ports/EnvironmentProbe.ts
interface EnvironmentProbe {
  testEnvironment(): Promise<EnvironmentStatus>
}

// domain/ports/SkillSync.ts
interface SkillSync {
  listSkills(): Promise<Skill[]>
  syncSkills(skills: Skill[]): Promise<void>
}

// domain/ports/ContextEnricher.ts
interface ContextEnricher {
  enrich(context: ExecutionContext): Promise<ExecutionContext>
}
```

### Claude Code Adapter (Launch)

```
packages/adapters/claude-local/src/
├── ClaudeExecutor.ts          # implements AgentExecutor
├── ClaudeSessionCodec.ts      # implements SessionCodec
├── ClaudeUsageParser.ts       # implements UsageParser
├── ClaudeEnvironment.ts       # implements EnvironmentProbe
└── index.ts                   # composes & registers all
```

### Adapter Registry

```typescript
const registry = new Map<string, AdapterFactory>()
registry.set('claude_local', () => new ClaudeLocalAdapter())
// Future: 'process', 'http', 'codex_local', 'gemini_local'
```

### Future Adapters

| Adapter | Priority |
|---|---|
| `process` (any shell command) | Phase 9 |
| `http` (webhook) | Phase 9 |
| `codex_local` | Phase 9 |
| `gemini_local` | Phase 9 |

---

## 5. Error Handling

### Philosophy

Domain errors are typed values, not thrown exceptions. Use-cases return `Result<T, E>`. Route handlers translate domain errors to HTTP status codes. No try-catch spaghetti.

### Result Type

```typescript
// packages/domain/src/result.ts
type Result<T, E> = { ok: true; value: T } | { ok: false; error: E }
```

### Domain Error Examples

```typescript
// Typed per use-case — errors are part of the domain vocabulary
type CheckoutError = 'already_checked_out' | 'issue_not_found' | 'budget_exhausted'
type ApproveError = 'approval_not_found' | 'already_resolved' | 'not_authorized'
type HireAgentError = 'adapter_not_found' | 'budget_limit_reached' | 'approval_required'

// Use-case signature
function checkoutIssue(issueId: string, agentId: string): Promise<Result<Issue, CheckoutError>>
```

### Route Translation

```typescript
// server/src/routes/checkout-issue.ts — thin controller
const result = await checkoutIssue(issueId, agentId)
if (result.ok) return res.status(200).json(result.value)

switch (result.error) {
  case 'already_checked_out': return res.status(409).json({ error: result.error })
  case 'issue_not_found':     return res.status(404).json({ error: result.error })
  case 'budget_exhausted':    return res.status(403).json({ error: result.error })
}
```

### Infrastructure Errors

Adapters (DB, Claude CLI, filesystem) catch infrastructure exceptions and translate them to domain errors at the boundary. Infrastructure errors never leak into use-cases.

```typescript
// adapters/storage/drizzle-issue-repo.ts
async findById(id: string): Promise<Result<Issue, 'not_found' | 'storage_unavailable'>> {
  try {
    const row = await db.select().from(issues).where(eq(issues.id, id))
    if (!row) return { ok: false, error: 'not_found' }
    return { ok: true, value: toDomain(row) }
  } catch (e) {
    return { ok: false, error: 'storage_unavailable' }
  }
}
```

---

## 6. API Design

Single REST API serving both dashboard UI and agents. Same endpoints, different authorization scopes.

### Auth Model

| Caller | Method | Scope |
|---|---|---|
| Board (dashboard) | Better Auth session cookie | Full access to their companies |
| Board (CLI) | Board API key | Full access to their companies |
| Agent (heartbeat) | Short-lived JWT (per run, 1h expiry) | Scoped to own company, own assignments |

### Route Structure

```
/api
├── /auth                              # Better Auth routes
├── /companies                         # CRUD, templates, import/export
│   └── /:companyId
│       ├── /agents                    # CRUD, hire/fire, pause/resume, invoke
│       │   └── /:agentId
│       │       ├── /runs              # Run history, logs
│       │       └── /budget            # Budget config, spend summary
│       ├── /goals                     # CRUD, status tracking
│       ├── /projects                  # CRUD, workspace config
│       ├── /issues                    # CRUD, checkout, status transitions
│       │   └── /:issueId
│       │       ├── /comments          # Read/write
│       │       ├── /documents         # Attach, revisions
│       │       └── /checkout          # Atomic claim (409 conflict)
│       ├── /approvals                 # Pending/resolved, approve/deny
│       ├── /routines                  # CRUD, cron/webhook triggers
│       ├── /costs                     # Aggregated spend
│       ├── /activity                  # Audit log
│       ├── /learnings                 # Learning system
│       ├── /skills                    # Skill library
│       └── /plugins                   # Plugin management
├── /events                            # SSE — separated from REST
│   └── /:companyId                    # Company-scoped stream
└── /health                            # Readiness + liveness probes
```

### Route Implementation (One File Per Use-Case)

Route handlers are thin controllers — 5-10 lines each. Parse request, call use-case, translate result to HTTP response. No business logic in routes.

```
server/src/routes/
├── create-company.ts        → CreateCompany use-case
├── checkout-issue.ts        → CheckoutIssue use-case → 409 on already_checked_out
├── post-comment.ts          → PostComment use-case
├── approve-action.ts        → ApproveAction use-case
├── deny-action.ts           → DenyAction use-case
├── invoke-agent.ts          → InvokeAgent use-case
├── hire-agent.ts            → HireAgent use-case
├── create-goal.ts           → CreateGoal use-case
├── ...
```

### SSE Events (Our Differentiator)

Two SSE channels with different concerns:

**Domain events** — for UI state updates (all connected dashboards):

```
GET /events/:companyId
```

- `agent.status_changed` — active/idle/error/paused transitions
- `issue.status_changed` / `issue.comment_added`
- `approval.requested` / `approval.resolved`
- `budget.warning` / `budget.exhausted`
- `learning.extracted`

**Agent stream** — for live transcript (only when Inspector is open):

```
GET /events/:companyId/agents/:agentId/stream
```

- `agent.stream.chunk` — raw stdout from the running adapter process
- Only subscribed when the Inspector panel is open for that agent
- Not stored as domain events — ephemeral stream data
- Saves bandwidth: not pushed to every connected dashboard

This separation keeps domain events clean (state transitions only) and treats raw process output as the adapter concern it is.

Paperclip has no real-time equivalent. Their UI polls.

---

## 7. Dashboard — Mission Control

### UI Philosophy (Norman & Nielsen)

1. **One primary view** — Mission Control, 90% of user time
2. **Inspector panels, not pages** — click anything, detail slides in
3. **Progressive disclosure** — nav grows with company complexity
4. **Live presence** — SSE everywhere, agents pulse when active
5. **Goal-first entry** — empty state IS onboarding

### Pages (7 total, vs Paperclip's 30+)

| Page | Route | Purpose |
|---|---|---|
| Mission Control | `/` | Agent cards, current work, activity, stats, inspector |
| Org Chart | `/org` | Visual agent hierarchy with live status, hire agents |
| Goals | `/goals` | Hierarchical tree with progress bars |
| Approvals | `/approvals` | Risk-colored cards, batch approve, denial history |
| Costs | `/costs` | Spend charts, budget utilization, agent cost table |
| Learnings | `/learnings` | Confidence scores, application stats, pin/dismiss |
| Settings | `/settings` | Governance, secrets, skills, plugins, team, general |

Routines appears in nav only when the company has routines (progressive disclosure).

### Norman & Nielsen Fixes (All Incorporated)

| # | Fix | Principle |
|---|---|---|
| 1 | Activity stream dims when Inspector open | Norman — constrain attention |
| 2 | Agents sorted by status → org rank | Norman — meaningful spatial arrangement |
| 3 | "Get Started" shows progress animation | Norman — feedback on invisible actions |
| 4 | Routines promoted to nav when relevant | Norman — progressive disclosure |
| 5 | 10-second undo window for Board actions | Nielsen — user control and freedom |
| 6 | Checkout conflicts surfaced on issue cards | Nielsen — error prevention |
| 7 | Failed run error on agent card | Nielsen — help recognize errors |
| 8 | Pre-flight environment check before onboarding | Nielsen — prevent errors, don't explain them |

### Onboarding Flow (CEO-Driven)

No separate wizard. The CEO agent IS the onboarding:

1. User types company name + goal (2 inputs, 1 button)
2. Progress animation: Creating company → Hiring CEO → Starting heartbeat → Opening Mission Control
3. CEO's first heartbeat reads the goal, creates approval to connect repos (if needed)
4. Board connects repos via Inspector panel
5. CEO scans repos, creates issues, hires agents (via approvals)
6. Work begins

**Existing company with repos:** Same flow. CEO agent asks for repo access via approval. Board connects. No separate onboarding track.

**90-second timeline:** Open → type goal → Get Started → CEO pulsing green → first comment appears → issues created → worker agent writing code.

---

## 8. Governance & Approvals

### Configurable Governance Policy

Not a fixed table — Board configures which actions need approval:

**Default gates (ship with):** Hire/fire agents, budget changes, connect repos, install plugins.
**Board can add:** "Approve issues over $X", "approve cross-project work."
**Board can remove:** "Auto-approve routine creation."

### Approval Flow

```
Agent proposes action with justification
    ↓
System calculates risk level (low/medium/high)
  - Based on: action type, cost impact, reversibility
  - NOT agent-proposed (fox-guarding-henhouse)
    ↓
Board sees: proposal + justification + risk + denial history
    ↓
Board acts: approve / deny (with feedback) / batch approve
    ↓
10-second undo window (deferred execution)
    ↓
Timeout: auto-approve low / auto-deny high (configurable)
```

### Features Beyond Paperclip

| Feature | Sheldon | Paperclip |
|---|---|---|
| Configurable policy | Yes — Board tightens/loosens over time | Fixed gates |
| Risk-colored badges | Green/orange/red pulse on nav | Just a count |
| Approval timeout + default action | Yes — 2h default, configurable | Agents just wait |
| Batch approvals | Yes — related proposals grouped | One by one |
| Denial history on re-proposals | Yes — shows evolution | No |
| System-calculated risk | Yes — based on cost/type/reversibility | No |
| Undo window | 10 seconds | No |
| Notification channel | Email/webhook when approvals pending | No |

---

## 9. Learning System (Sheldon Exclusive)

Paperclip has zero organizational learning. This is our biggest differentiator.

### Architecture (Clean — Event-Driven)

```
run.completed event
  ├── LearningExtractor (use-case)   → creates new learnings
  └── LearningEvaluator (use-case)   → scores applied learnings

Heartbeat preparation:
  └── ContextEnricher port
        └── LearningContextEnricher (adapter)
              └── Queries: project → domain → pinned company-wide
```

The heartbeat doesn't know learnings exist. It calls a `ContextEnricher` port. The learning system doesn't know heartbeats exist. It reacts to `run.completed` events. The domain event is the only connection.

### Learning Entity

```typescript
{
  id: string
  companyId: string
  projectId: string              // Scoped to project first
  summary: string
  context: string
  domain: string                 // e.g., "express", "auth", "testing"
  tags: string[]
  confidence: number             // 0.0 - 1.0, adjusts over time
  sourceIssueId: string
  sourceRunId: string
  status: 'active' | 'pinned' | 'dismissed'
}
```

### Use Cases (Separated Read/Write)

**Agent-driven (automated):**
- `ExtractLearning` — creates from run analysis, listens to run.completed
- `RecordLearningApplication` — updates confidence from outcomes

**Board-driven (manual):**
- `PinLearning` — marks as always-inject
- `DismissLearning` — soft-delete with undo
- `EditLearning` — Board refines summary/tags

### Confidence Feedback Loop

```
Learning extracted (confidence: 0.7)
  → Applied in future task
    → Task succeeded: confidence += 0.1
    → Task failed / irrelevant: confidence -= 0.15
  → Below 0.2: auto-decayed (Board notified)
  → Board pins: always injected regardless of confidence
```

### Injection Priority

```
1. Learnings from this project (highest relevance)
2. Learnings from same-domain projects in this company
3. Pinned company-wide learnings (Board-curated)
Top 5 by confidence score injected into agent system prompt.
```

---

## 10. Plugin System

### SDK — Composition Over Configuration

```typescript
import { definePlugin, cronJob, eventHandler, uiSlot, settingsPanel, storage } from '@sheldon/plugin-sdk'

definePlugin({
  id: 'github-sync',
  name: 'GitHub Sync',
  version: '1.0.0',
  extensions: [
    cronJob({ id: 'sync', cron: '*/15 * * * *', handler: syncRepos }),
    eventHandler({ event: 'issue.status_changed', handler: onStatusChange }),
    uiSlot({ slot: 'inspector.tabs', label: 'GitHub', component: 'GitHubTab' }),
    settingsPanel({ fields: [
      { key: 'github_token', type: 'secret', label: 'GitHub Token' }
    ]}),
    storage({ tables: {
      syncState: { columns: { repoUrl: 'text', lastSyncAt: 'timestamp' } }
    }})
  ]
})
```

### Extension Types

| Factory | Returns | Purpose |
|---|---|---|
| `cronJob()` | CronJobExtension | Scheduled background work |
| `eventHandler()` | EventHandlerExtension | React to PluginEventMap events |
| `uiSlot()` | UISlotExtension | Dashboard component hooks |
| `apiRoute()` | APIRouteExtension | Custom endpoints under /api/plugins/:id/ |
| `settingsPanel()` | SettingsExtension | Config form in Settings |
| `storage()` | StorageExtension | Prefixed DB tables per plugin |

### Published Event Contracts

```typescript
// packages/shared/src/plugin-events.ts
interface PluginEventMap {
  'issue.status_changed': { issueId: string, oldStatus: Status, newStatus: Status }
  'run.completed': { runId: string, agentId: string, outcome: Outcome }
  'approval.resolved': { approvalId: string, decision: 'approved' | 'denied' }
}
```

Internal domain events can evolve freely. Only `PluginEventMap` events are the public contract.

### Isolation & Safety

- **Worker threads** — crashing plugin doesn't take down server
- **Prefixed DB tables** — `plugin_{id}_{table}`, no cross-plugin access
- **Resource limits** — maxMemoryMb, maxCpuTimeMs, maxApiCallsPerMinute (Board-configurable)
- **Auto-pause** — 3 violations → disabled, Board notified
- **Two-part packages** — `server/` (worker thread) + `ui/` (lazy-loaded bundle), never cross

### UI Slots (4 defined)

| Slot | Location |
|---|---|
| `mission-control.widgets` | Bottom of Mission Control |
| `inspector.tabs` | Extra tab in Inspector panel |
| `settings.sections` | Tab in Settings page |
| `agent-card.badges` | Badge on agent cards |

---

## 11. Must-Have Features (From Paperclip Gap Analysis)

| Feature | Description | Phase |
|---|---|---|
| Execution Workspaces | Managed sandbox per task — CWD, repo, branch, lifecycle | 2 |
| Session Compaction | Auto-prune history at 200 turns / 2M tokens / 72h | 2 |
| Log Redaction | Mask home dirs and sensitive data from agent logs | 2 |
| Secrets Management | Encrypted vault per company, versioned, agent-accessible via API | 3 |
| Work Products | Track PRs/branches/artifacts per issue | 3 |
| Invite System | Invite links, join requests, multi-user Board | 6 |
| Company Import/Export | Portable YAML+markdown format, collision strategies | 6 |
| CLI Doctor Command | Diagnostic tool — DB, LLM, ports, secrets, auth checks | 8 |

---

## 12. Phase Plan

### Phase 1 — Foundation (Domain-First)
**Deliverable: `sheldon start` shows Mission Control with onboarding**

**Domain layer COMPLETE (built first, before any delivery mechanism):**
- All entities defined: Company, Agent, Goal, Project, Issue, Comment, Document, HeartbeatRun, Approval, Budget, CostEvent, Learning, LearningApplication, Routine, WorkProduct, Skill
- All ports defined: AgentExecutor, SessionCodec, UsageParser, EnvironmentProbe, SkillSync, ContextEnricher, plus repository ports for every entity
- All use-case interfaces defined with Result<T, E> signatures (stubs where implementation comes in later phases)
- Typed domain errors per use-case
- Result type and shared domain primitives

**Infrastructure wiring:**
- pnpm monorepo scaffold (domain, db, server, services, ui, cli, shared, adapters)
- Drizzle schema mirroring domain entities
- PGlite for local, Postgres connection for prod
- Express 5 server with thin route controllers calling use-cases
- Better Auth (local_trusted mode)
- CLI: `sheldon start`

**Dashboard skeleton:**
- React 19 + Vite + Radix + Tailwind 4
- Mission Control empty state → onboarding flow
- SSE endpoint wired (domain events channel)

### Phase 2 — Heartbeat Engine
**Deliverable: Agents wake up and do work**

- Heartbeat service — trigger queue, concurrency, run lifecycle
- Claude Code adapter (all ports implemented)
- Adapter registry
- Execution workspaces — create, track, derive, cleanup
- Agent spawning with env vars + JWT auth
- Session persistence + compaction
- Run logging with log redaction
- Budget enforcement — pre-run check, auto-pause
- Cost event recording

### Phase 3 — Communication & Governance
**Deliverable: Agents coordinate, Board governs**

- Issue lifecycle with atomic checkout (409)
- Issue comments
- Documents with revision history
- Work products tracking
- Configurable approval system with risk levels
- Approval timeout + default actions
- Batch approvals, denial history
- 10-second undo window
- Activity log
- Secrets management

### Phase 4 — Dashboard
**Deliverable: Mission Control fully live**

- Mission Control — agents, issues, activity, stats, inspector
- Inspector panel — issue/agent detail with tabs
- Org Chart with live status
- Goals page with hierarchy
- Approvals page — risk badges, batch, undo bar
- Costs page — charts, budget bars
- Settings — governance, secrets, skills, team, general
- SSE integration — live typing, stdout streaming
- Pre-flight check, progress animation, company switcher

### Phase 5 — Learning System
**Deliverable: Agents get smarter**

- LearningExtractor + LearningEvaluator (event-driven)
- ContextEnricher port + LearningContextEnricher adapter
- Project-scoped → domain → pinned query hierarchy
- Board curation — pin, dismiss, edit
- Learnings page with confidence, application stats
- Mission Control widget

### Phase 6 — Multi-User & Templates
**Deliverable: Teams collaborate, companies are portable**

- Better Auth authenticated mode
- Invite system — links, join requests, approval
- Multi-user Board (admin, member, viewer roles)
- Company import/export (YAML+markdown)
- Starter templates (Dev Team, Content Agency, Data Pipeline)
- OAuth prep (Google, GitHub)

### Phase 7 — Plugin Ecosystem
**Deliverable: Third parties can extend Sheldon**

- Plugin SDK — definePlugin() with extensions
- Plugin runtime — worker threads, resource enforcement
- Published event contracts (PluginEventMap)
- Two-part packages (server/ + ui/)
- Storage provisioner (prefixed tables)
- Plugin lifecycle + auto-pause
- Plugin UI in Settings
- Example plugins

### Phase 8 — CLI & Operations
**Deliverable: Production-ready tooling**

- CLI: start, doctor, company-export, company-import
- CLI auth challenges for remote server
- Doctor command (DB, LLM, ports, secrets, auth)
- Routines — cron + webhook triggers
- Routines nav (progressive disclosure)
- Instance settings
- Notification channel (email/webhook)

### Phase 9 — Polish
**Deliverable: Production-grade refinements**

- Agent config revisions + rollback
- Budget incidents
- Finance events (billing-grade)
- Labels for issues
- Inbox / My Issues with read states
- Assets / file upload (local + S3)
- Feedback/voting on agent outputs
- Quota windows (rate-limit view)
- Evals framework (promptfoo)
- Additional adapters: process, http, codex, gemini

---

## Mockups

Screen mockups are saved in `.superpowers/brainstorm/` directory:
- `screen-01-onboarding.html` — Welcome (happy + blocked), progress animation
- `screen-02-mission-control.html` — Full app shell with inspector
- `screen-03-org-goals-approvals.html` — Org chart, goals tree, approval cards
- `screen-04-costs-learnings-settings.html` — Cost charts, learning cards, governance settings
