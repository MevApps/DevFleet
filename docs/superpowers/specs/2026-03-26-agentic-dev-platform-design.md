# Agentic Development Platform — Design Spec

> **Codename:** DevFleet
> **Date:** 2026-03-26
> **Status:** Design approved, pending implementation plan

## 1. Vision

A modular, plugin-based multi-agent system that operates like a real software company. Specialized AI agents (Product, Architect, Developer, Reviewer, Ops, Learner) work autonomously under a Supervisor, communicating through structured handoffs and a shared channel. A real-time web dashboard gives the CEO (you) full visibility. A BI engine (DevBrain) tracks everything and derives actionable insights.

**Core principles:**
- **Generic** — works on any project: mobile, web, backend, desktop, ML
- **Modular** — every piece is a plugin. Connect, disconnect, swap, scale.
- **Autonomous** — agents run until you intervene. CEO mode, not micromanagement.
- **Self-improving** — the Learner agent + DevBrain feedback loop makes every project faster than the last
- **Cost-efficient** — fixed budgets per task, keep/discard discipline, metrics on every dollar spent
- **Clean Architecture** — Uncle Bob's dependency rule enforced structurally, not by convention

---

## 2. Clean Architecture Layers

Uncle Bob's dependency rule: **source code dependencies point inward only.** Inner layers know nothing about outer layers. No exceptions.

```
┌─────────────────────────────────────────────────────────┐
│  Layer 4: Frameworks & Drivers (outermost)              │
│  Next.js, PostgreSQL driver, Claude SDK, WebSocket,     │
│  Redis client, filesystem                               │
├─────────────────────────────────────────────────────────┤
│  Layer 3: Interface Adapters                            │
│  Plugins, API routes, DB repositories, AI provider      │
│  adapters, dashboard presenters, message bus impl       │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Application (Use Cases)                       │
│  Orchestrate agents, manage tasks, evaluate metrics,    │
│  route messages, enforce budgets, gate phases           │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Entities (innermost — pure domain)            │
│  Agent, Task, Message, Project, Skill, Metric,          │
│  Budget, Artifact, Event — plain objects, zero deps     │
└─────────────────────────────────────────────────────────┘
```

### Layer 1: Entities (Pure Domain)

Zero dependencies. Zero framework imports. These are plain TypeScript types and classes with business rules embedded. Testable with no setup.

```typescript
// --- Identity types ---

// AgentRole = extensible branded string. Built-in roles are constants, not a closed union.
// Custom plugins (Security Agent, Designer Agent) register their own role strings.
type AgentRole = string & { readonly __brand: "AgentRole" }

// Built-in roles — use these constants, not raw strings
const ROLES = {
  SUPERVISOR: "supervisor" as AgentRole,
  PRODUCT: "product" as AgentRole,
  ARCHITECT: "architect" as AgentRole,
  DEVELOPER: "developer" as AgentRole,
  REVIEWER: "reviewer" as AgentRole,
  OPS: "ops" as AgentRole,
  LEARNER: "learner" as AgentRole,
} as const

// AgentId = unique identifier for each running instance (e.g., "developer-opus-1").
type AgentId = string & { readonly __brand: "AgentId" }

// --- Goal entity (CEO's intent — decomposed into Tasks) ---

interface Goal {
  readonly id: GoalId
  readonly description: string
  readonly status: GoalStatus
  readonly createdAt: number
  readonly completedAt: number | null
  readonly taskIds: ReadonlyArray<TaskId>
  readonly totalBudget: TokenBudget
}

type GoalStatus = "proposed" | "active" | "completed" | "abandoned"

// --- Task entity ---

interface Task {
  readonly id: TaskId
  readonly goalId: GoalId                 // every task belongs to a goal
  readonly description: string
  readonly status: TaskStatus
  readonly phase: string                  // configurable per project pipeline, not a fixed union
  readonly assignedTo: AgentId | null     // assigned to an instance, not a role
  readonly budget: TokenBudget
  readonly tokensUsed: number
  readonly version: number                // optimistic concurrency — incremented on every update
  readonly artifacts: ReadonlyArray<ArtifactId>  // references, not embedded objects
  readonly parentTaskId: TaskId | null
}

type TaskStatus = "queued" | "in_progress" | "review" | "approved" | "merged" | "discarded"

// Business rule lives IN the entity, not in a service
function canTransition(task: Task, to: TaskStatus): boolean {
  const allowed: Record<TaskStatus, ReadonlyArray<TaskStatus>> = {
    queued: ["in_progress", "discarded"],
    in_progress: ["review", "discarded"],
    review: ["approved", "in_progress"],  // back to dev on rejection
    approved: ["merged"],
    merged: [],
    discarded: [],
  }
  return allowed[task.status].includes(to)
}

function isOverBudget(task: Task): boolean {
  return task.tokensUsed > task.budget.maxTokens
}
```

**Phases are configuration, not code.** Each project defines its own pipeline — a sequence of valid phase transitions:

```typescript
// Project config defines valid phases and transitions
interface PipelineConfig {
  readonly phases: ReadonlyArray<string>     // e.g., ["ideation", "spec", "plan", "code", "test", "review", "done"]
  readonly transitions: ReadonlyArray<{
    from: string
    to: string
  }>
  readonly skipAllowed: ReadonlyArray<{       // e.g., bug fix can skip "design"
    from: string
    to: string
    condition: string                         // human-readable: "when task type is 'bugfix'"
  }>
}

function canAdvancePhase(task: Task, to: string, pipeline: PipelineConfig): boolean {
  return pipeline.transitions.some(t => t.from === task.phase && t.to === to)
}
```

A simple bug fix project might use `["plan", "code", "test", "review", "done"]`. A full-featured product uses the complete pipeline. Adding "security-review" = one config change, zero code changes. Open/Closed.

**Key entities:**
- `Goal` — CEO's intent. Decomposed into Tasks. DevBrain tracks cost-per-goal.
- `Task` — unit of work with status, phase, budget, artifacts. Always belongs to a Goal.
- `Agent` — role + configuration + current state (idle/busy/blocked)
- `Message` — typed payload routed through the bus (see Message Types below)
- `Project` — repo pointer + config + loaded skills + pipeline definition
- `Skill` — named convention document with scope (which agents use it)
- `Artifact` — spec, plan, diff, test report, review — anything an agent produces
- `Metric` — typed measurement with timestamp and agent/task attribution
- `Budget` — token limit + cost limit per task/agent/project
- `Event` — immutable record of something that happened (for DevBrain)
- `Conversation` — agent's message history with the AI provider

### Layer 2: Use Cases (Application Logic)

Use cases orchestrate entities. Each use case is a single class with a single public method. They depend on **port interfaces** (defined here in Layer 2), never on implementations.

```typescript
// --- Ports (interfaces) — defined in Layer 2, implemented in Layer 3 ---

interface TaskRepository {
  findById(id: TaskId): Promise<Task | null>
  create(task: Task): Promise<void>
  update(task: Task): Promise<void>          // throws VersionConflictError if task.version is stale
}

interface GoalRepository {
  findById(id: GoalId): Promise<Goal | null>
  create(goal: Goal): Promise<void>
  update(goal: Goal): Promise<void>
}

interface AgentRegistry {
  findAvailable(role: AgentRole): Promise<Agent | null>
  findById(id: AgentId): Promise<Agent | null>
}

interface MessagePort {
  emit(message: Message): Promise<void>
  subscribe(filter: MessageFilter, handler: MessageHandler): Unsubscribe
}

interface AICompletionProvider {              // Basic text completion
  complete(prompt: AgentPrompt, budget: TokenBudget): Promise<AIResponse>
  readonly capabilities: ReadonlySet<AICapability>
}

interface AIToolProvider {                    // Tool use — separate interface (ISP)
  completeWithTools(prompt: AgentPrompt, tools: ReadonlyArray<Tool>, budget: TokenBudget): Promise<AIToolResponse>
}

type AICapability = "tool_use" | "vision" | "streaming" | "json_mode" | "extended_context"

// An AI provider implements what it supports:
// Claude adapter: AICompletionProvider + AIToolProvider
// Local LLM: AICompletionProvider only
// Caller checks capabilities before using AIToolProvider.

interface FileSystem {                       // Agent's window into filesystem (not raw fs)
  read(path: string): Promise<string>
  write(path: string, content: string): Promise<void>
  edit(path: string, oldContent: string, newContent: string): Promise<void>
  glob(pattern: string): Promise<ReadonlyArray<string>>
}

interface ShellExecutor {                    // Agent's window into shell (not raw child_process)
  execute(command: string, timeout?: number): Promise<ShellResult>
}

// --- Use case example ---

class AssignTask {
  constructor(
    private readonly tasks: TaskRepository,
    private readonly agents: AgentRegistry,
    private readonly bus: MessagePort,
  ) {}

  async execute(taskId: TaskId, role: AgentRole): Promise<Result<Task>> {
    const task = await this.tasks.findById(taskId)
    if (!task) return Result.failure("Task not found")
    if (task.status !== "queued") return Result.failure("Task not assignable")

    const agent = await this.agents.findAvailable(role)
    if (!agent) return Result.failure(`No available ${role} agent`)

    const assigned: Task = {
      ...task,
      assignedTo: agent.id,
      status: "in_progress",
      version: task.version + 1,
    }
    await this.tasks.update(assigned)      // throws on version conflict — caller retries
    await this.bus.emit({ type: "task.assigned", taskId, agentId: agent.id })
    return Result.success(assigned)
  }
}
```

**Key use cases:**
- `AssignTask` — Supervisor assigns work to an agent instance
- `DecomposeGoal` — Supervisor breaks a Goal into phased Tasks
- `CheckBudget` — Can this agent proceed with another turn? (predictive token estimate)
- `PromptAgent` — Send prompt to AI provider, get response. Checks `AICapability` before using tools.
- `ExecuteToolCalls` — Run the tools the AI requested (via `FileSystem` and `ShellExecutor` ports)
- `RecordTurnMetrics` — Log tokens, cost, duration for this turn
- `EvaluateTurnOutcome` — Success, failure, or blocked? Determine next action.
- `RouteMessage` — Deliver a typed message to all subscribers
- `EvaluateKeepDiscard` — After review, keep (merge branch) or discard (delete branch)
- `RecordMetric` — Append a metric event to the store
- `DeriveInsight` — DevBrain analyzes metrics and produces recommendations
- `LoadProject` — Scan a repo, detect stack, load skills, create project config
- `UpdateAgentPrompt` — Learner modifies an agent's system prompt (versioned)

Note: the old `ExecuteAgentTurn` has been decomposed into 5 focused use cases (`CheckBudget`, `PromptAgent`, `ExecuteToolCalls`, `RecordTurnMetrics`, `EvaluateTurnOutcome`) — each with a single responsibility. The agent plugin composes them in sequence.

### Layer 3: Interface Adapters

Adapters implement the ports defined in Layer 2. They translate between domain and infrastructure. This is where plugins live.

```typescript
// adapters/PostgresTaskRepository.ts — implements the port
class PostgresTaskRepository implements TaskRepository {
  constructor(private readonly db: DatabaseClient) {}

  async findById(id: TaskId): Promise<Task | null> {
    const row = await this.db.query("SELECT * FROM tasks WHERE id = $1", [id])
    return row ? mapRowToTask(row) : null
  }

  async create(task: Task): Promise<void> {
    await this.db.query("INSERT INTO tasks (...) VALUES (...)", taskToParams(task))
  }

  async update(task: Task): Promise<void> {
    const result = await this.db.query(
      "UPDATE tasks SET ... WHERE id = $1 AND version = $2",
      taskToParams(task),
    )
    if (result.rowCount === 0) throw new VersionConflictError(task.id, task.version)
  }
}

// adapters/ClaudeAIProvider.ts — implements BOTH ports
class ClaudeAIProvider implements AICompletionProvider, AIToolProvider {
  readonly capabilities: ReadonlySet<AICapability> = new Set([
    "tool_use", "vision", "streaming", "json_mode", "extended_context",
  ])

  constructor(private readonly client: Anthropic) {}

  async complete(prompt: AgentPrompt, budget: TokenBudget): Promise<AIResponse> {
    const response = await this.client.messages.create({
      model: prompt.model,
      max_tokens: Math.min(budget.remaining, prompt.maxTokens),
      system: prompt.systemPrompt,
      messages: prompt.messages,
    })
    return mapToAIResponse(response)
  }

  async completeWithTools(
    prompt: AgentPrompt,
    tools: ReadonlyArray<Tool>,
    budget: TokenBudget,
  ): Promise<AIToolResponse> {
    const response = await this.client.messages.create({
      model: prompt.model,
      max_tokens: Math.min(budget.remaining, prompt.maxTokens),
      system: prompt.systemPrompt,
      messages: prompt.messages,
      tools: tools.map(mapToClaudeTool),
    })
    return mapToAIToolResponse(response)
  }
}

// A local LLM adapter implements ONLY AICompletionProvider — no tool support.
// The PromptAgent use case checks capabilities before calling completeWithTools.
```

**Adapter categories:**
- **Repository adapters** — PostgreSQL, SQLite, in-memory (all implement same port)
- **AI provider adapters** — Claude, OpenAI, local LLM (all implement `AIProvider` port)
- **Message bus adapter** — Redis pub/sub, in-memory (implements `MessagePort`)
- **Notification adapters** — WebSocket push, Slack, email, webhook
- **Project loader adapters** — Git scanner, manual config, CI integration
- **Dashboard presenters** — transform domain data into view models for the UI

### Layer 4: Frameworks & Drivers

The outermost layer. Next.js, database drivers, SDK clients, WebSocket server. **This layer is disposable** — you can swap Next.js for Remix, PostgreSQL for MongoDB, without touching Layers 1-3.

---

## 3. SOLID at Every Boundary

### Single Responsibility

The fat `Plugin` interface from the brainstorm violates SRP. Split it — each interface has one reason to change:

```typescript
// Lifecycle — when the plugin starts/stops (one reason to change: lifecycle semantics)
interface Lifecycle {
  start(): Promise<void>
  stop(): Promise<void>
  healthCheck(): Promise<HealthStatus>
}

// MessageHandler — how the plugin communicates (one reason to change: message protocol)
interface MessageHandler {
  subscriptions(): ReadonlyArray<MessageFilter>
  handle(message: Message): Promise<void>        // Message is a typed union, not string
}

// DashboardContributor — what the plugin shows (one reason to change: UI contract)
interface DashboardContributor {
  widgets(): ReadonlyArray<DashboardWidget>
}

// Configurable<T> — type-safe configuration (one reason to change: config shape)
interface Configurable<TConfig> {
  configSchema(): JsonSchema
  configure(config: TConfig): Promise<void>
}

// A plugin composes only the interfaces it needs:
// Developer agent: PluginIdentity + Lifecycle + MessageHandler
// DevBrain: PluginIdentity + Lifecycle + MessageHandler + DashboardContributor
// Cost tracker: PluginIdentity + Lifecycle + MessageHandler + DashboardContributor
//
// Dependencies are constructor-injected — no PluginContext god-object.
```

### Open/Closed

The system is **open for extension** (add any plugin) and **closed for modification** (never edit core to add a plugin).

Adding a new agent = write a class implementing `Lifecycle + MessageHandler`, register it. Zero changes to core, Supervisor, or other agents.

Adding a new dashboard section = implement `DashboardContributor`, return widgets. Dashboard shell renders whatever is registered.

Adding a new AI provider = implement `AIProvider` port. Swap it in config. No agent code changes.

### Liskov Substitution

Any `AIProvider` implementation (Claude, OpenAI, local) must be swappable without the caller knowing. The `AIProvider` port defines the contract — callers depend on the contract, not the implementation.

Any `TaskRepository` implementation (Postgres, SQLite, in-memory) must behave identically from the caller's perspective.

### Interface Segregation

Already addressed — split interfaces. An agent that doesn't contribute dashboard widgets never implements `DashboardContributor`. An agent that doesn't need configuration never implements `Configurable`.

The `MessageHandler` interface itself is narrow: subscribe to what you care about, handle it. You don't receive messages you didn't ask for.

### Dependency Inversion

**The most important principle in this system.** Use cases define ports (interfaces). Adapters implement them. The wiring happens at the composition root (Layer 4, startup).

```
Use Case (Layer 2) ──defines──► TaskRepository (port/interface)
                                       ▲
                                       │ implements
Adapter (Layer 3)  ──────────► PostgresTaskRepository

// The use case NEVER imports PostgresTaskRepository.
// It receives a TaskRepository at construction time.
```

No `import { PostgresTaskRepository }` in use case code. Ever. Dependency injection at the composition root wires concrete implementations to abstract ports.

---

## 4. Agent System

### 4.1 The Seven Agents

Each agent is a plugin (`Lifecycle + MessageHandler`) that wraps an AI conversation loop. All agents share the same execution engine — they differ in system prompt, tools, and message subscriptions.

```typescript
// The universal agent execution loop
interface AgentExecutor {
  run(agent: AgentConfig, task: Task, context: AgentContext): AsyncIterable<AgentEvent>
}

interface AgentConfig {
  readonly role: AgentRole
  readonly systemPrompt: string          // includes skills, conventions
  readonly tools: ReadonlyArray<Tool>    // what this agent can do
  readonly model: ModelId                // which AI model to use
  readonly budget: TokenBudget           // per-turn and per-task limits
}

interface AgentContext {
  readonly project: Project
  readonly task: Task
  readonly artifacts: ReadonlyArray<Artifact>  // from prior phases
  readonly conversation: Conversation          // agent's history
}
```

#### Supervisor
- **Subscribes to:** `goal.created`, `task.completed`, `task.failed`, `review.approved`, `review.rejected`, `budget.exceeded`, `agent.stuck`
- **Emits:** `task.created`, `task.assigned`, `branch.merged`, `branch.discarded`, `goal.completed`
- **Tools:** task decomposition, agent assignment, branch management, budget allocation
- **Superpowers DNA:** `writing-plans` (decomposition logic), `dispatching-parallel-agents` (parallelization), `finishing-a-development-branch` (merge/discard decisions)
- **Model:** Highest-tier (Opus) — orchestration quality is worth the cost

#### Product
- **Subscribes to:** `goal.created` (reactive), `schedule.ideation` (proactive — runs on interval)
- **Emits:** `spec.created`, `idea.proposed`
- **Tools:** codebase analysis, web search (trends, competitors), project history
- **Superpowers DNA:** `brainstorming` (structured ideation process)
- **Skills loaded:** `innovation-radar`, `analytics-architecture` (from project config)
- **Model:** High-tier (Opus/Sonnet) — creative reasoning needs quality

#### Architect
- **Subscribes to:** `spec.created`, `task.needs_plan`
- **Emits:** `plan.created`, `design.created`
- **Tools:** codebase reading, module dependency analysis, file structure exploration
- **Superpowers DNA:** `writing-plans` (implementation plan creation)
- **Model:** High-tier (Opus/Sonnet) — structural decisions are expensive to fix

#### Developer
- **Subscribes to:** `task.assigned` (when assigned to developer role)
- **Emits:** `task.code.completed`, `test.written`, `branch.pushed`
- **Tools:** file read/write/edit, shell execution (build, test), git operations, worktree management
- **Superpowers DNA:** `executing-plans` (step-by-step), `test-driven-development` (tests first)
- **Skills loaded:** all project-specific code skills (from project config)
- **Model:** Configurable — Sonnet for straightforward tasks, Opus for complex ones
- **Autoresearch pattern:** works in isolated git worktree. Bounded blast radius.

#### Reviewer
- **Subscribes to:** `task.code.completed`
- **Emits:** `review.approved`, `review.rejected` (with reasons + specific line comments)
- **Tools:** diff reading, test execution, convention checking, spec comparison
- **Superpowers DNA:** `requesting-code-review` + `receiving-code-review`, `verification-before-completion` (must prove it works)
- **Skills loaded:** all project-specific code skills (for convention enforcement)
- **Model:** High-tier — review quality directly controls keep/discard ratio

#### Ops
- **Subscribes to:** `branch.pushed`, `task.code.completed`, `build.requested`
- **Emits:** `build.passed`, `build.failed`, `test.report.created`, `perf.report.created`
- **Tools:** shell execution (build, test, lint), log analysis, metric collection
- **Superpowers DNA:** `systematic-debugging` (root cause, not guessing), `profiler` (performance analysis)
- **Model:** Lower-tier (Haiku/Sonnet) — mostly running commands and parsing output. Cost-efficient.

#### Learner
- **Subscribes to:** `review.rejected`, `review.approved`, `goal.completed`, `budget.exceeded`, `insight.generated`, `ceo.override`
- **Emits:** `agent.prompt.updated`, `skill.updated`, `system.improvement`
- **Tools:** metrics query (DevBrain), agent prompt read/write, skill file read/write, git history analysis
- **Superpowers DNA:** `continuous-learning` (pattern detection), `innovation-radar` (opportunity spotting)
- **Model:** High-tier (Opus) — meta-reasoning requires the best model
- **Schedule:** Runs analysis after every completed goal + periodic sweep (configurable)

### 4.2 Agent Execution Model (Autoresearch-Inspired)

Every agent turn follows the autoresearch loop:

```
┌─► Receive task/message
│   │
│   ▼
│   Check budget — if exceeded, pause and alert Supervisor
│   │
│   ▼
│   Execute turn (prompt AI, get response, take actions)
│   │
│   ▼
│   Record metrics (tokens used, time, actions taken)
│   │
│   ▼
│   Evaluate outcome:
│   ├── Success → emit completion message, advance
│   ├── Failure → emit failure, attempt recovery (max 3 retries)
│   └── Blocked → emit blocked message, wait for resolution
│   │
│   ▼
│   Update conversation history
│   │
└───┘ (loop until task complete or budget exhausted)
```

**Fixed budget per task** (autoresearch's 5-minute rule):
- Each task gets a token budget allocated by the Supervisor
- Budget is based on task complexity (estimated by Architect's plan)
- If exceeded: agent pauses, Supervisor decides — extend budget or discard
- All spend is tracked per-agent, per-task, per-project

**Keep/discard discipline:**
- Developer works on an isolated git worktree branch
- On `review.approved` → Supervisor merges the branch (keep)
- On `review.rejected` (after max retries) → Supervisor deletes the branch (discard)
- Every keep/discard is logged with full context for DevBrain

### 4.3 Communication System

Two channels, as discussed:

**Structured Handoffs** — artifacts passed between phases:
```typescript
// Artifact uses a discriminated union — every type has a known metadata shape.
// No Record<string, unknown>. The compiler knows exactly what each artifact carries.

type Artifact =
  | {
      readonly id: ArtifactId
      readonly kind: "spec"
      readonly format: "markdown"
      readonly taskId: TaskId
      readonly createdBy: AgentId
      readonly content: string          // markdown: ## Requirements, ## Success Criteria, ## Constraints
      readonly metadata: { requirementCount: number; hasSuccessCriteria: boolean }
    }
  | {
      readonly id: ArtifactId
      readonly kind: "plan"
      readonly format: "markdown"
      readonly taskId: TaskId
      readonly createdBy: AgentId
      readonly content: string          // markdown: ## Step N: Title + acceptance criteria
      readonly metadata: { stepCount: number; estimatedTokens: number }
    }
  | {
      readonly id: ArtifactId
      readonly kind: "design"
      readonly format: "markdown"
      readonly taskId: TaskId
      readonly createdBy: AgentId
      readonly content: string          // markdown with embedded JSON blocks
      readonly metadata: { componentCount: number }
    }
  | {
      readonly id: ArtifactId
      readonly kind: "diff"
      readonly format: "diff"
      readonly taskId: TaskId
      readonly createdBy: AgentId
      readonly content: string          // unified diff (git diff output)
      readonly metadata: { filesChanged: number; linesAdded: number; linesRemoved: number }
    }
  | {
      readonly id: ArtifactId
      readonly kind: "review"
      readonly format: "markdown"
      readonly taskId: TaskId
      readonly createdBy: AgentId
      readonly content: string          // markdown with file:line comments
      readonly metadata: { verdict: "approved" | "rejected"; issueCount: number }
    }
  | {
      readonly id: ArtifactId
      readonly kind: "test_report"
      readonly format: "json"
      readonly taskId: TaskId
      readonly createdBy: AgentId
      readonly content: string          // JSON: { passed, failed, details }
      readonly metadata: { passed: number; failed: number; coverageDelta: number }
    }
  | {
      readonly id: ArtifactId
      readonly kind: "metric_report"
      readonly format: "json"
      readonly taskId: TaskId
      readonly createdBy: AgentId
      readonly content: string          // JSON: { metrics, period }
      readonly metadata: { metricCount: number; periodStart: number; periodEnd: number }
    }

// Access metadata type-safely:
// if (artifact.kind === "diff") { artifact.metadata.filesChanged } ← compiler knows this exists
```
Product creates a spec artifact → Architect reads it and creates a plan artifact → Developer reads both and creates a diff artifact → Reviewer reads all three.

**Shared Channel** — for discussion, questions, debates:
```typescript
interface ChannelMessage {
  readonly id: MessageId
  readonly taskId: TaskId | null         // null = general discussion
  readonly from: AgentId
  readonly to: AgentId | "all"
  readonly content: string
  readonly replyTo: MessageId | null     // threading
  readonly timestamp: number
}
```
Developer asks Architect: "Should this be a new module or extend the existing one?" Architect responds. All visible on dashboard.

### 4.4 Typed Message Events

All message types are compile-time checked — no magic strings. A typo in a subscription is a compile error, not a silent bug:

```typescript
// Discriminated union — every message type has a known shape
type Message =
  // Goal lifecycle
  | { type: "goal.created"; goalId: GoalId; description: string }
  | { type: "goal.completed"; goalId: GoalId; costUsd: number }
  | { type: "goal.abandoned"; goalId: GoalId; reason: string }
  // Task lifecycle
  | { type: "task.created"; taskId: TaskId; goalId: GoalId; phase: string }
  | { type: "task.assigned"; taskId: TaskId; agentId: AgentId }
  | { type: "task.completed"; taskId: TaskId; agentId: AgentId }
  | { type: "task.failed"; taskId: TaskId; agentId: AgentId; reason: string }
  // Artifact handoffs
  | { type: "spec.created"; taskId: TaskId; artifactId: ArtifactId }
  | { type: "plan.created"; taskId: TaskId; artifactId: ArtifactId }
  | { type: "design.created"; taskId: TaskId; artifactId: ArtifactId }
  // Code lifecycle
  | { type: "code.completed"; taskId: TaskId; branch: string; filesChanged: number; testsWritten: number }
  | { type: "branch.pushed"; taskId: TaskId; branch: string }
  | { type: "branch.merged"; taskId: TaskId; branch: string; commit: string }
  | { type: "branch.discarded"; taskId: TaskId; branch: string; reason: string }
  // Build & test
  | { type: "build.passed"; taskId: TaskId; durationMs: number }
  | { type: "build.failed"; taskId: TaskId; error: string }
  | { type: "test.report.created"; taskId: TaskId; passed: number; failed: number; coverageDelta: number }
  // Review
  | { type: "review.approved"; taskId: TaskId; reviewerId: AgentId }
  | { type: "review.rejected"; taskId: TaskId; reviewerId: AgentId; reasons: ReadonlyArray<string> }
  // Budget
  | { type: "budget.exceeded"; taskId: TaskId; agentId: AgentId; tokensUsed: number; budgetMax: number }
  // System
  | { type: "agent.prompt.updated"; agentRole: AgentRole; diff: string; reason: string }
  | { type: "skill.updated"; skillName: string; diff: string; reason: string }
  | { type: "insight.generated"; insightId: string; recommendation: string; confidence: number }
  | { type: "ceo.override"; taskId: TaskId; action: string; reason: string }
  // Scheduling
  | { type: "schedule.ideation"; projectId: ProjectId }
  | { type: "agent.stuck"; agentId: AgentId; taskId: TaskId; retryCount: number }

// Subscriptions are type-safe:
type MessageType = Message["type"]

// MessageFilter uses the union — no string literals outside this file
interface MessageFilter {
  readonly types: ReadonlyArray<MessageType>
}
```

This means adding a new message type requires adding it to the union — and the compiler tells you everywhere that needs to handle it.

---

## 5. DevBrain (BI Engine)

### 5.1 Event Store

Every action in the system produces an immutable event:

```typescript
interface SystemEvent {
  readonly id: EventId
  readonly timestamp: number
  readonly source: AgentId | "system" | "ceo"
  readonly type: MessageType                      // same typed union as Message — no separate string taxonomy
  readonly taskId: TaskId | null
  readonly goalId: GoalId | null
  readonly projectId: ProjectId
  readonly message: Message                       // the full typed message that triggered this event
  readonly cost: {
    readonly tokensIn: number
    readonly tokensOut: number
    readonly costUsd: number
    readonly durationMs: number
  }
}
```

Events are append-only. Never mutated. Never deleted. This is the source of truth for all analytics. The `message` field carries the full typed payload — no `Record<string, unknown>` escape hatch.

### 5.2 Three Tiers of Intelligence

**Tier 1 — Operational (real-time)**
Computed from live event stream. Dashboard updates via WebSocket/SSE.
- Agent status (idle/busy/blocked)
- Active tasks and their phases
- Live token spend (per-agent, per-task, running total)
- Current agent conversations (streamable)

**Tier 2 — Performance (periodic aggregation)**
Computed on intervals (hourly, daily) or on-demand.
- Keep/discard ratio per agent, per project, over time
- Review pass rate (first-attempt approvals vs. rework cycles)
- Cost per feature (total tokens × price from goal creation to merge)
- Phase duration breakdown (where does the pipeline stall?)
- Test coverage delta per merged task
- Agent efficiency trend (tokens per successful task, improving or degrading?)

**Tier 3 — Strategic Insights (AI-derived)**
The Learner agent queries Tier 1+2 metrics and applies reasoning:
- Pattern detection: "Reviewer rejected 4/6 PRs for the same reason"
- Correlation: "Tasks with Architect plans under 500 words have 2x rejection rate"
- Recommendations: "Update Developer's system prompt with X" or "Product's ideation criteria should weight Y"
- Forecasting: "At current cost-per-feature, this project will cost $X to complete remaining goals"
- System health: "Learner's last 3 prompt updates improved keep rate by 12%"

### 5.3 CEO Alerts

Pushed notifications. You configure severity thresholds.

| Alert | Severity | Trigger |
|---|---|---|
| Feature complete | Info | `goal.completed` event |
| Agent stuck (3+ retries) | Warning | Retry count exceeded |
| Budget exceeded | Warning | Task tokens > 2× estimate |
| Rejection loop | Urgent | 3+ rejections on same task |
| High-confidence idea | Info | Product proposes with high score |
| Weekly digest | Info | Scheduled (configurable) |
| System improvement applied | Info | Learner updated a prompt/skill |

---

## 6. Plugin System

### 6.1 Plugin Interfaces (ISP-compliant)

```typescript
// plugins/interfaces.ts — Layer 2 (application boundary)

// Every plugin must have identity
interface PluginIdentity {
  readonly id: string
  readonly name: string
  readonly version: string
  readonly description: string
}

// Lifecycle management
interface Lifecycle {
  start(): Promise<void>
  stop(): Promise<void>
  healthCheck(): Promise<HealthStatus>
}

// Message-based communication
interface MessageHandler {
  subscriptions(): ReadonlyArray<MessageFilter>
  handle(message: Message): Promise<void>
}

// Dashboard UI contribution
interface DashboardContributor {
  widgets(): ReadonlyArray<DashboardWidget>
  routes?(): ReadonlyArray<DashboardRoute>
}

// Configuration
interface Configurable<TConfig> {
  configSchema(): JsonSchema
  configure(config: TConfig): Promise<void>
}
```

**No PluginContext god-object.** Each plugin declares exactly what it needs via constructor injection. The composition root provides only those dependencies:

```typescript
// DeveloperPlugin needs: MessagePort + Logger + AICompletionProvider + AIToolProvider + FileSystem + ShellExecutor
// It gets exactly those — nothing more.
class DeveloperPlugin implements PluginIdentity, Lifecycle, MessageHandler {
  constructor(
    private readonly bus: MessagePort,
    private readonly logger: Logger,
    private readonly ai: AICompletionProvider,
    private readonly tools: AIToolProvider,
    private readonly fs: FileSystem,
    private readonly shell: ShellExecutor,
  ) {}
  // ...
}

// DevBrainPlugin needs: MessagePort + Logger + MetricRecorder + EventStore
// Different deps, same pattern.
class DevBrainPlugin implements PluginIdentity, Lifecycle, MessageHandler, DashboardContributor {
  constructor(
    private readonly bus: MessagePort,
    private readonly logger: Logger,
    private readonly metrics: MetricRecorder,
    private readonly events: EventStore,
  ) {}
  // ...
}

// The composition root wires each plugin with ONLY its declared dependencies.
// A plugin CANNOT access what it didn't ask for. ISP enforced structurally.
```

### 6.2 Plugin Discovery & Registration

```typescript
// Plugins are discovered, not hardcoded
interface PluginRegistry {
  register(plugin: PluginIdentity & Lifecycle): Promise<void>
  deregister(pluginId: string): Promise<void>
  discover(filter?: PluginFilter): ReadonlyArray<RegisteredPlugin>
  onPluginRegistered(callback: (plugin: RegisteredPlugin) => void): Unsubscribe
  onPluginDeregistered(callback: (pluginId: string) => void): Unsubscribe
}
```

Plugins discover each other through the registry, but **never import each other directly.** All communication goes through the message bus.

### 6.3 Plugin Categories & Defaults

**Ships with the system (built-in plugins):**
- 7 agent plugins (Supervisor, Product, Architect, Developer, Reviewer, Ops, Learner)
- Claude AI provider adapter
- SQLite storage adapter (zero-config local development)
- In-memory message bus (single-process mode)
- DevBrain analytics engine
- WebSocket notification adapter
- Git project loader

**Optional (swap-in):**
- OpenAI / Anthropic / local LLM provider adapters
- PostgreSQL storage adapter (production / team mode)
- Redis message bus (multi-process / distributed mode)
- Slack / email / webhook notification adapters
- Custom agent plugins (Security Agent, Designer Agent with Figma, etc.)

### 6.4 Multiple Instances

The same plugin class can be instantiated multiple times with different configs:

```typescript
// 3 Developer agents with different model tiers
{ id: "developer-1", role: "developer", model: "claude-sonnet-4-6", tasks: "straightforward" }
{ id: "developer-2", role: "developer", model: "claude-opus-4-6", tasks: "complex" }
{ id: "developer-3", role: "developer", model: "claude-haiku-4-5", tasks: "boilerplate" }
```

Supervisor distributes tasks based on estimated complexity → matching model tier.

---

## 7. Project Configuration

### 7.1 Project Config Schema

```typescript
interface ProjectConfig {
  readonly name: string
  readonly repoPath: string                           // local path or git URL
  readonly techStack: TechStack                       // auto-detected, user-adjustable
  readonly skills: ReadonlyArray<SkillReference>      // loaded into agent prompts
  readonly conventions: string                        // CLAUDE.md / CONTRIBUTING.md content
  readonly buildCommand: string                       // "./gradlew build", "npm run build"
  readonly testCommand: string                        // "./gradlew test", "npm test"
  readonly lintCommand?: string
  readonly moduleStructure?: ModuleMap                // auto-detected
  readonly qualityGates: ReadonlyArray<QualityGate>   // must-pass before merge
  readonly budgetDefaults: BudgetDefaults             // token limits per task complexity
  readonly agentOverrides?: Record<AgentRole, Partial<AgentConfig>>  // per-project agent tuning
}

interface TechStack {
  readonly languages: ReadonlyArray<string>
  readonly frameworks: ReadonlyArray<string>
  readonly buildTool: string
  readonly testFramework: string
  readonly packageManager?: string
}

interface QualityGate {
  readonly name: string
  readonly command: string
  readonly required: boolean                          // block merge if fails
}
```

### 7.2 Auto-Detection

When you point the system at a repo:

1. **Language detection** — scan file extensions, package files
2. **Framework detection** — parse `build.gradle.kts` → Android/Kotlin, `package.json` → Node.js, `pyproject.toml` → Python
3. **Build/test commands** — infer from build tool config, CI files, scripts
4. **Module structure** — parse settings files (`settings.gradle.kts`, `workspaces`, `tsconfig.json` references)
5. **Conventions** — read `CLAUDE.md`, `CONTRIBUTING.md`, `.cursorrules`, `AGENTS.md`, `README.md`
6. **Skills** — import from `~/.claude/skills/` or `.claude/skills/` if they exist
7. **Git history** — recent commit patterns, branch strategy, PR conventions

Auto-detected config is presented for review. You adjust and confirm. Saved as `devfleet.config.json` in the project root (or wherever you choose).

---

## 8. Dashboard

### 8.1 Tech Stack

- **Framework:** Next.js 15 (App Router)
- **Language:** TypeScript (strict mode)
- **UI:** React + Tailwind CSS + shadcn/ui (composable, unstyled primitives)
- **Real-time:** Server-Sent Events for live streaming, WebSocket for bidirectional
- **State:** Zustand (minimal, no boilerplate)
- **Database:** Prisma ORM (abstracts Postgres/SQLite)
- **Charts:** Recharts or Tremor (for DevBrain visualizations)

### 8.2 Dashboard Sections

Sections are rendered from `DashboardContributor` plugins. Built-in sections:

**1. Live Floor**
- All agents displayed with status indicators (idle / working / blocked / paused)
- Click any agent → see its live conversation stream (SSE)
- Shared channel visible as a threaded chat sidebar
- Active task cards showing phase, progress, budget consumption

**2. Pipeline**
- Kanban-style: columns for each phase (Ideation → Spec → Design → Plan → Code → Test → Review → Done)
- Tasks flow left-to-right as agents complete phases
- Color-coded by status (green = on track, yellow = over time, red = over budget)
- Click task → full detail: artifacts from each phase, agent conversations, metrics

**3. Financials**
- Real-time token spend (total, per-agent, per-task)
- Cost per feature (historical chart, trend line)
- Budget utilization gauges
- Forecasting: "at this rate, remaining goals cost $X"
- Model tier distribution: how much spend goes to Opus vs. Sonnet vs. Haiku

**4. Quality**
- Keep/discard ratio (overall, per-agent, over time)
- Review pass rate (first-attempt vs. rework)
- Test coverage movement (per-task deltas)
- Convention violation frequency (from Reviewer reports)
- Top rejection reasons (aggregated from Reviewer feedback)

**5. Insights (DevBrain)**
- Tier 3 strategic recommendations as actionable cards
- "Accept" → Learner implements the recommendation
- "Dismiss" → logged, won't resurface
- "Discuss" → opens a thread with you and relevant agents
- Historical insights with outcome tracking (did the recommendation improve metrics?)

**6. Ideas (Product Agent)**
- Product Agent's proactive feature proposals
- Each idea has: description, rationale, estimated complexity, potential impact
- You can: promote to goal, dismiss, ask for more detail, or discuss
- Ideas that you consistently dismiss teach Product Agent your preferences (via Learner)

**7. History**
- Searchable log of all events, decisions, artifacts
- Filter by: agent, task, project, date range, event type
- Full audit trail: every keep/discard with context
- Exportable for reporting

**8. System**
- Agent prompt versions (diff view — what Learner changed and why)
- Skill versions (tracked per project)
- Plugin status (loaded, health, config)
- System config editor

### 8.3 CEO Interaction Points

The dashboard isn't just observation — it's your command interface:

- **Create goal** — type a high-level objective, Supervisor takes over
- **Override** — pause any agent, change a decision, redirect work
- **Approve/reject ideas** — from Product Agent's proposals
- **Adjust budgets** — increase/decrease token limits per task or globally
- **Chat with any agent** — open a conversation with any agent directly
- **Configure alerts** — set thresholds for what gets pushed to you

---

## 9. Self-Improvement Loop

The system's most valuable long-term property. Inspired by autoresearch's `program.md` iteration — but automated.

### The Loop

```
Agents work → Events recorded → DevBrain aggregates →
Learner analyzes → Improvements proposed → Applied (or CEO reviews) →
Agents work better → Repeat
```

### What the Learner Improves

| Target | Example | How |
|---|---|---|
| Agent system prompts | "Developer keeps forgetting to run lint" | Add lint reminder to Developer's prompt |
| Skill files | "Reviewer catches the same naming issue repeatedly" | Update the naming section of the relevant skill |
| Budget defaults | "Simple tasks consistently use only 30% of budget" | Lower default budget for simple tasks |
| Model assignments | "Ops agent works fine with Haiku, save money" | Downgrade Ops to Haiku |
| Task decomposition | "Large tasks get rejected more often" | Tell Supervisor to decompose more granularly |
| Quality gates | "Tests pass but lint fails after merge" | Add lint as a required pre-merge gate |

### Guardrails

- All Learner changes are versioned (git-tracked agent prompts and skills)
- Changes can be auto-applied (fast lane) or require CEO approval (safe lane)
- You configure which: e.g., "auto-apply budget changes, require approval for prompt changes"
- Every change includes: what changed, why (linked to metrics), expected impact
- Rollback: one click to revert any Learner change

---

## 10. Directory Structure

```
devfleet/
├── src/
│   ├── entities/                    # Layer 1 — pure domain
│   │   ├── Goal.ts
│   │   ├── Task.ts
│   │   ├── Agent.ts
│   │   ├── AgentRole.ts             # Branded type + ROLES constants
│   │   ├── Message.ts               # Typed discriminated union — all message types
│   │   ├── Artifact.ts              # Typed discriminated union — all artifact kinds
│   │   ├── ExperimentResult.ts      # Autoresearch keep/discard record
│   │   ├── Project.ts
│   │   ├── PipelineConfig.ts        # Configurable phases & transitions
│   │   ├── Skill.ts
│   │   ├── Metric.ts
│   │   ├── Budget.ts
│   │   ├── Event.ts
│   │   └── Conversation.ts
│   │
│   ├── use-cases/                   # Layer 2 — application logic
│   │   ├── ports/                   # Interfaces (Dependency Inversion)
│   │   │   ├── TaskRepository.ts    # create() + update() (no save())
│   │   │   ├── GoalRepository.ts
│   │   │   ├── AgentRegistry.ts
│   │   │   ├── AICompletionProvider.ts
│   │   │   ├── AIToolProvider.ts
│   │   │   ├── FileSystem.ts
│   │   │   ├── ShellExecutor.ts
│   │   │   ├── MessagePort.ts
│   │   │   ├── EventStore.ts
│   │   │   ├── MetricRecorder.ts
│   │   │   └── ProjectLoader.ts
│   │   ├── AssignTask.ts
│   │   ├── DecomposeGoal.ts
│   │   ├── CheckBudget.ts           # Can this turn proceed?
│   │   ├── PromptAgent.ts           # Send prompt, check capabilities first
│   │   ├── ExecuteToolCalls.ts      # Run tools via FileSystem + ShellExecutor ports
│   │   ├── RecordTurnMetrics.ts     # Log tokens, cost, duration
│   │   ├── EvaluateTurnOutcome.ts   # Success, failure, or blocked?
│   │   ├── RouteMessage.ts
│   │   ├── EvaluateKeepDiscard.ts
│   │   ├── RecordMetric.ts
│   │   ├── DeriveInsight.ts
│   │   ├── LoadProject.ts
│   │   └── UpdateAgentPrompt.ts
│   │
│   ├── adapters/                    # Layer 3 — interface adapters
│   │   ├── plugins/                 # Plugin implementations
│   │   │   ├── agents/              # Agent plugins
│   │   │   │   ├── SupervisorPlugin.ts
│   │   │   │   ├── ProductPlugin.ts
│   │   │   │   ├── ArchitectPlugin.ts
│   │   │   │   ├── DeveloperPlugin.ts
│   │   │   │   ├── ReviewerPlugin.ts
│   │   │   │   ├── OpsPlugin.ts
│   │   │   │   └── LearnerPlugin.ts
│   │   │   ├── ai-providers/        # AI adapter plugins
│   │   │   │   ├── ClaudeProvider.ts
│   │   │   │   └── OpenAIProvider.ts
│   │   │   ├── storage/             # Storage adapter plugins
│   │   │   │   ├── PostgresAdapter.ts
│   │   │   │   ├── SQLiteAdapter.ts
│   │   │   │   └── InMemoryAdapter.ts
│   │   │   ├── messaging/           # Message bus plugins
│   │   │   │   ├── RedisBus.ts
│   │   │   │   └── InMemoryBus.ts
│   │   │   ├── notifications/       # Notification plugins
│   │   │   │   ├── WebSocketNotifier.ts
│   │   │   │   └── SlackNotifier.ts
│   │   │   └── analytics/           # Analytics plugins
│   │   │       └── DevBrainPlugin.ts
│   │   ├── repositories/            # Port implementations
│   │   │   ├── PostgresTaskRepo.ts
│   │   │   ├── SQLiteTaskRepo.ts
│   │   │   └── InMemoryTaskRepo.ts
│   │   └── presenters/              # Dashboard view models
│   │       ├── LiveFloorPresenter.ts
│   │       ├── PipelinePresenter.ts
│   │       └── FinancialsPresenter.ts
│   │
│   ├── infrastructure/              # Layer 4 — frameworks & drivers
│   │   ├── web/                     # Next.js app
│   │   │   ├── app/                 # App Router pages
│   │   │   │   ├── layout.tsx
│   │   │   │   ├── page.tsx                    # Live Floor (default)
│   │   │   │   ├── pipeline/page.tsx
│   │   │   │   ├── financials/page.tsx
│   │   │   │   ├── quality/page.tsx
│   │   │   │   ├── insights/page.tsx
│   │   │   │   ├── ideas/page.tsx
│   │   │   │   ├── history/page.tsx
│   │   │   │   ├── system/page.tsx
│   │   │   │   └── api/                        # API routes
│   │   │   │       ├── agents/route.ts
│   │   │   │       ├── tasks/route.ts
│   │   │   │       ├── events/stream/route.ts  # SSE endpoint
│   │   │   │       └── goals/route.ts
│   │   │   ├── components/                     # React UI components
│   │   │   │   ├── agents/
│   │   │   │   ├── tasks/
│   │   │   │   ├── chat/
│   │   │   │   ├── charts/
│   │   │   │   └── shared/
│   │   │   └── hooks/
│   │   ├── database/
│   │   │   ├── schema.prisma
│   │   │   └── migrations/
│   │   └── config/
│   │       └── composition-root.ts             # DI wiring — the ONLY place that knows all concretions
│   │
│   └── plugin-sdk/                  # Published SDK for third-party plugins
│       ├── interfaces.ts            # All plugin interfaces
│       ├── testing.ts               # Test helpers for plugin authors
│       └── index.ts
│
├── agent-prompts/                   # Versioned agent system prompts (git-tracked)
│   ├── supervisor.md
│   ├── product.md
│   ├── architect.md
│   ├── developer.md
│   ├── reviewer.md
│   ├── ops.md
│   └── learner.md
│
├── skills/                          # Project-agnostic skills (shipped with system)
│   └── (empty — loaded from project config)
│
├── devfleet.config.example.json     # Example project configuration
├── package.json
├── tsconfig.json
├── prisma/
│   └── schema.prisma
└── README.md
```

---

## 11. Composition Root

The **single place** that violates the dependency rule — because it must. It wires concrete implementations to abstract ports. Uncle Bob calls this the "Main component."

```typescript
// infrastructure/config/composition-root.ts
// This is the ONLY file that imports concrete adapter classes — Uncle Bob's "Main component."

// --- Factory registry pattern (Open/Closed) ---
// Adding a new storage adapter = register a factory. No if/else chains.

type Factory<T> = (config: SystemConfig) => T

const storageFactories: Record<string, Factory<TaskRepository & GoalRepository>> = {
  postgres: (c) => new PostgresRepository(c.databaseUrl),
  sqlite: (c) => new SQLiteRepository(c.sqlitePath),
  memory: () => new InMemoryRepository(),
}

const aiFactories: Record<string, Factory<AICompletionProvider>> = {
  claude: (c) => new ClaudeProvider(c.anthropicApiKey),
  openai: (c) => new OpenAIProvider(c.openaiApiKey),
}

const busFactories: Record<string, Factory<MessagePort>> = {
  redis: (c) => new RedisBus(c.redisUrl),
  memory: () => new InMemoryBus(),
}

export function buildSystem(config: SystemConfig): DevFleet {
  // Resolve infrastructure from factories — no conditionals
  const storage = storageFactories[config.storage](config)
  const ai = aiFactories[config.aiProvider](config)
  const bus = busFactories[config.messageBus](config)
  const logger = new StructuredLogger(config.logLevel)
  const metrics = new MetricRecorderImpl(storage)
  const fs = new SandboxedFileSystem(config.projectPath)   // scoped to project
  const shell = new SandboxedShellExecutor(config.projectPath)

  // Use cases (wired with ports)
  const assignTask = new AssignTask(storage, agentRegistry, bus)
  const checkBudget = new CheckBudget(storage)
  const promptAgent = new PromptAgent(ai)
  const executeTools = new ExecuteToolCalls(fs, shell)
  const recordMetrics = new RecordTurnMetrics(metrics)
  const evaluateOutcome = new EvaluateTurnOutcome(storage, bus)
  // ... etc.

  // Agent plugins — each receives ONLY its declared dependencies (no god-object context)
  const developer = new DeveloperPlugin(bus, logger, ai, ai as AIToolProvider, fs, shell)
  const reviewer = new ReviewerPlugin(bus, logger, ai, fs)
  const ops = new OpsPlugin(bus, logger, shell, metrics)
  const supervisor = new SupervisorPlugin(bus, logger, ai, storage, assignTask)
  // ... etc.

  // Plugin registration
  const registry = new PluginRegistryImpl()
  const allPlugins = [developer, reviewer, ops, supervisor /* ... */]
  allPlugins.forEach(p => registry.register(p))

  return { registry, bus, config }
}
```

**Agent plugins are Layer 3 adapters.** They never import `fs`, `child_process`, or SDK clients directly. They receive `FileSystem` and `ShellExecutor` ports — keeping the plugin cleanly in Layer 3, with framework details hidden behind ports injected from Layer 4.

---

## 12. Cost Efficiency — The Autoresearch Engine

Not just inspired by autoresearch — the system **runs** the autoresearch experiment loop as its core execution model. Every agent task is an experiment: modify → run → measure → keep or discard.

### 12.1 The Experiment Loop (Running in Every Agent)

Adapted from Karpathy's `program.md` — the same loop that runs autonomous overnight research:

```
LOOP (until task complete or budget exhausted):

  1. PLAN — Agent reads context (artifacts, plan, skills) and proposes a change
  2. EXECUTE — Agent makes the change (code, spec, design — whatever its role produces)
  3. COMMIT — Change is committed to isolated branch (git commit with descriptive message)
  4. VALIDATE — Ops runs the validation suite:
     - Build: does it compile/bundle?
     - Test: do tests pass? What's the delta?
     - Lint: does it meet conventions?
     - Metrics: tokens used, time taken, files changed
  5. EVALUATE — Compare against baseline:
     ├── IMPROVED (tests pass, coverage up, conventions met) → KEEP (advance branch)
     ├── NEUTRAL (tests pass, no regression) → KEEP (advance branch)
     ├── REGRESSED (tests fail, coverage down, lint violations) → DISCARD (git reset to last good)
     └── CRASHED (build fails, timeout) → attempt fix (max 2), then DISCARD
  6. LOG — Record experiment to results log:
     { commit, metric, status: "keep" | "discard" | "crash", description, tokens, cost }
  7. REPEAT — Next iteration starts from the new baseline (if kept) or last good state (if discarded)
```

**This is the autoresearch loop, generalized.** In autoresearch, the metric is `val_bpb`. In DevFleet, the metric depends on the agent role:

| Agent | "Experiment" | Success Metric |
|---|---|---|
| Developer | Code change on a worktree branch | Tests pass + coverage ≥ baseline + lint clean |
| Architect | Plan/design document | Developer can execute it without clarification questions |
| Product | Spec document | Architect can produce a plan from it without ambiguity |
| Reviewer | Review verdict | Accuracy (does rejected code actually have issues? does approved code hold up?) |
| Ops | Build/test execution | Reliability (no false positives/negatives in validation) |
| Learner | Prompt/skill update | Keep rate improves in next N tasks |

### 12.2 Results Tracking (autoresearch's `results.tsv`)

Every experiment is logged to a persistent results store — the DevFleet equivalent of `results.tsv`:

```typescript
interface ExperimentResult {
  readonly id: string
  readonly taskId: TaskId
  readonly agentId: AgentId
  readonly commit: string              // short git hash
  readonly metric: number              // primary success metric (0-1 normalized)
  readonly tokensUsed: number
  readonly costUsd: number
  readonly durationMs: number
  readonly status: "keep" | "discard" | "crash"
  readonly description: string         // what was tried
  readonly baseline: number            // metric value before this experiment
  readonly delta: number               // metric - baseline (positive = improvement)
  readonly iteration: number           // which attempt (1, 2, 3...)
}
```

DevBrain aggregates these results for Tier 2/3 analytics. The Learner reads them to optimize the system.

### 12.3 The "NEVER STOP" Principle

From autoresearch: *"Do NOT pause to ask the human if you should continue. The human might be asleep."*

Applied to DevFleet:
- Once a goal is decomposed and agents are assigned, they **run autonomously** until all tasks are complete, budget is exhausted, or you intervene.
- No "should I continue?" prompts. Agents are autonomous researchers.
- If an agent runs out of ideas (e.g., Learner finds no improvements to make), it enters idle mode and wakes on the next relevant event.
- The system runs 24/7. You wake up to a log of experiments and (hopefully) better code.

### 12.4 The `program.md` Pattern — Agent Prompts as Research Org Code

From autoresearch: *"You are not touching Python files. Instead, you are programming the `program.md` Markdown files that set up your autonomous research org."*

Applied to DevFleet:
- Agent prompts in `agent-prompts/*.md` ARE the "research org code"
- **You iterate on prompts, not on agent code.** The agents' behavior changes by editing their `.md` files.
- The Learner automates this iteration — it modifies prompts based on experiment results, just as a human researcher would iterate on `program.md`.
- All prompt changes are git-tracked with diffs viewable in the dashboard.
- This is why the system constantly improves: the "research org code" evolves.

### 12.5 Cost Controls

| Principle | Implementation |
|---|---|
| **Fixed budget per task** | Supervisor allocates tokens based on Architect's complexity estimate. Hard cap, not soft. |
| **Model tiering** | Haiku for simple tasks (Ops, boilerplate). Sonnet for standard work. Opus for orchestration and meta-reasoning. |
| **Keep/discard discipline** | Work that fails review gets discarded (branch deleted), not endlessly reworked. Max 3 retry cycles. |
| **Context compression** | Agent conversations are summarized when they grow long. Only relevant history is kept in context. Threshold: when conversation exceeds 60% of model context window, compress older turns. |
| **Parallel execution** | Independent tasks run in parallel (multiple Developer instances). Time is money. |
| **Learner budget optimization** | Learner continuously tunes: downgrade model tiers that don't need quality, reduce budgets for predictable tasks. |
| **Metrics on every dollar** | Every API call is tracked: tokens in/out, cost, which task it served, what the outcome was. No unattributed spend. |
| **Simplicity criterion** | Adopted from autoresearch: simpler solutions are preferred. Complexity has a cost that must justify itself. |

---

## 13. What Requires CEO Involvement

The system is autonomous, but certain decisions should surface to you:

| Decision | Why you're involved |
|---|---|
| Promoting ideas to goals | You set the direction — Product proposes, you decide |
| Budget exceptions (>2× estimate) | Significant cost — your money, your call |
| Agent stuck after 3 retries | Something is fundamentally wrong — may need human judgment |
| Learner prompt changes (configurable) | Your team's DNA is changing — you may want to review |
| Cross-project decisions | "This pattern should be a shared skill" — architectural |
| New plugin installation | Security boundary — what gets access to your code |

Everything else runs autonomously. You watch, you learn, you intervene when you want.

---

## 14. Implementation Phases

This spec is too large for a single implementation plan. It decomposes into 4 phases, each independently shippable:

**Phase 1: Core + Single Agent (MVP)**
- Layer 1 entities (Goal, Task, Agent, Message union, Artifact union, PipelineConfig, Budget, Event)
- Layer 2 use cases (AssignTask, DecomposeGoal, CheckBudget, PromptAgent, ExecuteToolCalls, RecordTurnMetrics, EvaluateTurnOutcome, RouteMessage)
- Layer 2 ports (TaskRepository, GoalRepository, AICompletionProvider, AIToolProvider, FileSystem, ShellExecutor, MessagePort)
- In-memory adapters for all ports (zero-config local dev)
- Plugin system (registry, lifecycle, typed message routing)
- Single Developer agent plugin (end-to-end: receive task → write code → emit completion)
- SQLite storage adapter
- Claude AI provider adapter (implements both AICompletionProvider + AIToolProvider)
- Minimal CLI interface (no dashboard yet)
- **Exit criteria:** Can assign a coding task to Developer agent, it executes and produces typed artifacts

**Phase 2: Full Agent Team + Communication**
- Remaining 6 agent plugins (Supervisor, Product, Architect, Reviewer, Ops, Learner)
- Structured handoffs (artifact passing between phases)
- Shared channel (agent-to-agent discussion)
- Git worktree isolation for Developer
- Keep/discard loop (branch merge or delete based on review)
- Goal decomposition (CEO types goal → Supervisor decomposes → full pipeline)
- **Exit criteria:** Can type a high-level goal, agents autonomously produce merged code

**Phase 3: Dashboard + Real-Time Visibility**
- Next.js dashboard shell
- Live Floor (agent status, live conversations via SSE)
- Pipeline view (kanban)
- CEO interaction (create goal, override, chat with agents)
- Event store (PostgreSQL adapter)
- Tier 1 operational metrics (real-time spend, active tasks)
- **Exit criteria:** Can observe and control the full agent team from the browser

**Phase 4: DevBrain + Self-Improvement**
- Tier 2 performance analytics (keep/discard ratio, cost per feature, phase durations)
- Tier 3 strategic insights (Learner-driven recommendations)
- CEO alerts (push notifications)
- Learner feedback loop (prompt updates, skill updates, budget tuning)
- Financials dashboard section
- Quality dashboard section
- Insights dashboard section
- System health dashboard
- **Exit criteria:** System measurably improves its own performance over 10+ completed goals

---

## 15. Error Handling & Failure Recovery

**AI call failures:**
- Timeout: 60s per API call. On timeout, retry once with exponential backoff (2s, then 4s). After 2 retries, mark turn as failed.
- Rate limit: respect `retry-after` header. Queue the turn.
- Model unavailable: fall back to next tier (Opus → Sonnet → Haiku). Log the fallback.

**Agent failures:**
- Max 3 retries per task. A "retry" = Supervisor re-assigns the task to the same or different agent instance.
- After 3 retries: task status → "discarded", branch deleted, CEO alert.
- Agent crash (unhandled exception): restart plugin, log crash, re-assign task.

**Infrastructure failures:**
- Database unavailable: agents pause (no new tasks), in-flight tasks continue in memory, sync on reconnect.
- Message bus unavailable: fall back to in-memory bus (single-process mode). Alert CEO.
- Dashboard disconnect: SSE auto-reconnects. Missed events replayed from event store.

**Budget enforcement:**
- Budget checked BEFORE each AI call (predictive: estimated tokens based on prompt size).
- If predicted spend exceeds remaining budget: pause agent, alert Supervisor.
- Supervisor can: extend budget (within project limits), reassign to cheaper model, or discard.
- Over-budget spend (prediction was wrong): logged, counted, but turn completes. Next turn enforces.

---

## 16. Concurrency & Safety

- Entities are **immutable value objects** — no in-place mutation, always copy-on-write.
- Task state transitions use **optimistic concurrency** — version field on Task, update fails if version mismatch, caller retries with fresh state.
- Agent instances are **isolated** — each has its own conversation, worktree, and budget tracker. No shared mutable state between agents.
- Message handlers run **concurrently** — each subscription gets its own async execution. Handlers must be idempotent (same message delivered twice = same outcome).
- Message bus guarantees **at-least-once delivery** — handlers must handle duplicates gracefully. Event IDs enable deduplication.

---

## 17. Security & Access Control

**Plugin sandboxing via port injection (no PluginContext):**
- Plugins declare required permissions in their identity: `permissions: ["filesystem.read", "filesystem.write", "shell.execute", "network.outbound"]`
- The composition root enforces permissions by choosing which port implementations to inject:
  - Plugin declares `filesystem.read` only → receives `ReadOnlyFileSystem` (write/edit methods throw)
  - Plugin declares `shell.execute` → receives `SandboxedShellExecutor` (scoped to project dir)
  - Plugin declares no filesystem permission → receives no `FileSystem` port at all
- CEO reviews permissions on plugin installation. Permissions are checked at wiring time, not runtime.

**Project isolation:**
- Each project runs in its own context. Agents working on Project A cannot access Project B's files, conversations, or metrics.
- Multi-project mode: separate PluginContext per project, separate database schemas or row-level isolation.

**Secret management:**
- API keys stored in environment variables or system keychain, never in config files.
- Agent prompts and conversations are stored encrypted at rest.
- Dashboard requires local authentication (configurable: none for solo, password for team).

---

## 18. Future Extensions (Not in Scope, but Designed For)

The plugin architecture naturally supports:
- **Team mode** — multiple CEOs, role-based access, shared projects
- **Cloud deployment** — agents as serverless functions, dashboard as hosted app
- **Marketplace** — community plugins (agents, AI providers, integrations)
- **Mobile companion** — CEO alerts and quick actions from your phone
- **CI/CD integration** — Ops agent triggered by GitHub Actions / GitLab CI
- **Design tool integration** — Figma/design plugins for visual artifacts

These are not designed now, but the plugin architecture doesn't prevent them.
