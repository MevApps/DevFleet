import { InMemoryTaskRepo } from "../../adapters/storage/InMemoryTaskRepo"
import { InMemoryGoalRepo } from "../../adapters/storage/InMemoryGoalRepo"
import { InMemoryAgentRegistry } from "../../adapters/storage/InMemoryAgentRegistry"
import { InMemoryEventStore } from "../../adapters/storage/InMemoryEventStore"
import { InMemoryMetricRecorder } from "../../adapters/storage/InMemoryMetricRecorder"
import { InMemoryArtifactRepo } from "../../adapters/storage/InMemoryArtifactRepo"
import { InMemoryWorktreeManager } from "../../adapters/storage/InMemoryWorktreeManager"
import { NodeWorktreeManager } from "../../adapters/worktree/NodeWorktreeManager"
import { InMemoryKeepDiscardRepository } from "../../adapters/storage/InMemoryKeepDiscardRepository"
import { InMemoryInsightRepository } from "../../adapters/storage/InMemoryInsightRepository"
import { InMemoryBudgetConfigStore } from "../../adapters/storage/InMemoryBudgetConfigStore"
import { InMemoryAlertPreferencesStore } from "../../adapters/storage/InMemoryAlertPreferencesStore"
import { InMemoryWorkspaceRunRepository } from "../../adapters/storage/InMemoryWorkspaceRunRepository"
import { InMemoryBus } from "../../adapters/messaging/InMemoryBus"
import { NodeFileSystem } from "../../adapters/filesystem/NodeFileSystem"
import { NodeShellExecutor } from "../../adapters/shell/NodeShellExecutor"
import { FileSystemAgentPromptStore } from "../../adapters/filesystem/FileSystemAgentPromptStore"
import { FileSystemSkillStore } from "../../adapters/filesystem/FileSystemSkillStore"
import { ClaudeAgentSdkAdapter } from "../../adapters/ai-providers/ClaudeAgentSdkAdapter"
import { MockAgentSession } from "../../adapters/ai-providers/MockAgentSession"
import { NoOpNotificationAdapter } from "../../adapters/notifications/NoOpNotificationAdapter"
import { PluginRegistry } from "../../adapters/plugins/PluginRegistry"
import { SupervisorPlugin } from "../../adapters/plugins/agents/SupervisorPlugin"
import { ProductPlugin } from "../../adapters/plugins/agents/ProductPlugin"
import { ArchitectPlugin } from "../../adapters/plugins/agents/ArchitectPlugin"
import { DeveloperPlugin } from "../../adapters/plugins/agents/DeveloperPlugin"
import { ReviewerPlugin } from "../../adapters/plugins/agents/ReviewerPlugin"
import { OpsPlugin } from "../../adapters/plugins/agents/OpsPlugin"
import { LearnerPlugin } from "../../adapters/plugins/agents/LearnerPlugin"
import { CheckBudget } from "../../use-cases/CheckBudget"
import { RecordTurnMetrics } from "../../use-cases/RecordTurnMetrics"
import { RunAgentSession } from "../../use-cases/RunAgentSession"
import { RunBuildAndTest } from "../../use-cases/RunBuildAndTest"
import { EvaluateOutcome } from "../../use-cases/EvaluateOutcome"
import { DecomposeGoal } from "../../use-cases/DecomposeGoal"
import { AssignTask } from "../../use-cases/AssignTask"
import { EvaluateKeepDiscard } from "../../use-cases/EvaluateKeepDiscard"
import { MergeBranch } from "../../use-cases/MergeBranch"
import { DiscardBranch } from "../../use-cases/DiscardBranch"
import { CreateArtifactUseCase } from "../../use-cases/CreateArtifact"
import { DetectStuckAgent } from "../../use-cases/DetectStuckAgent"
import { CreateGoalFromCeo } from "../../use-cases/CreateGoalFromCeo"
import { PauseAgent } from "../../use-cases/PauseAgent"
import { ComputeFinancials } from "../../use-cases/ComputeFinancials"
import { ComputeQualityMetrics } from "../../use-cases/ComputeQualityMetrics"
import { ComputePhaseTimings } from "../../use-cases/ComputePhaseTimings"
import { AcceptInsight } from "../../use-cases/AcceptInsight"
import { DismissInsight } from "../../use-cases/DismissInsight"
import { DetectProjectConfig } from "../../use-cases/DetectProjectConfig"
import { EvaluateAlert, type AlertRule } from "../../use-cases/EvaluateAlert"
import { WorkspaceRunManager } from "../../use-cases/WorkspaceRunManager"
import { GitCloneIsolator } from "../../adapters/workspace/GitCloneIsolator"
import { NodeGitRemote } from "../../adapters/git/NodeGitRemote"
import { GitHubPullRequestCreator } from "../../adapters/git/GitHubPullRequestCreator"
import { LiveFloorPresenter } from "../../adapters/presenters/LiveFloorPresenter"
import { PipelinePresenter } from "../../adapters/presenters/PipelinePresenter"
import { MetricsPresenter } from "../../adapters/presenters/MetricsPresenter"
import { SSEManager } from "../http/sseManager"
import { toSystemEvent } from "./toSystemEvent"
import type { DashboardDeps } from "../http/createServer"
import { createAgentId, createProjectId } from "../../entities/ids"
import { join } from "node:path"
import { createAgent } from "../../entities/Agent"
import { ROLES } from "../../entities/AgentRole"
import { createPipelineConfig } from "../../entities/PipelineConfig"
import type { AgentSession } from "../../use-cases/ports/AgentSession"
import type { FileSystem } from "../../use-cases/ports/FileSystem"
import type { ShellExecutor, ShellExecutorFactory } from "../../use-cases/ports/ShellExecutor"
import type { TaskRepository } from "../../use-cases/ports/TaskRepository"
import type { GoalRepository } from "../../use-cases/ports/GoalRepository"
import type { AgentRegistry } from "../../use-cases/ports/AgentRegistry"
import type { EventStore } from "../../use-cases/ports/EventStore"
import type { MetricRecorder } from "../../use-cases/ports/MetricRecorder"
import type { ArtifactRepository } from "../../use-cases/ports/ArtifactRepository"
import type { MessagePort } from "../../use-cases/ports/MessagePort"

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
export interface DevFleetConfig {
  readonly workspaceDir: string
  readonly mockMode?: boolean
  readonly developerModel?: string
  readonly supervisorModel?: string
  readonly reviewerModel?: string
  readonly projectId?: string
  readonly pipelineTimeoutMs?: number
  readonly agentTimeoutMs?: number
  readonly maxRetries?: number
  readonly buildCommand?: string
  readonly testCommand?: string
}

// ---------------------------------------------------------------------------
// System interface (exposes port interfaces — dependency rule respected)
// ---------------------------------------------------------------------------
export interface DevFleetSystem {
  readonly taskRepo: TaskRepository
  readonly goalRepo: GoalRepository
  readonly agentRegistry: AgentRegistry
  readonly eventStore: EventStore
  readonly metricRecorder: MetricRecorder
  readonly artifactRepo: ArtifactRepository
  readonly bus: MessagePort
  readonly pluginRegistry: PluginRegistry
  readonly pipelineTimeoutMs: number
  readonly dashboardDeps: DashboardDeps
  start(): Promise<void>
  stop(): Promise<void>
}

// ---------------------------------------------------------------------------
// Default pipeline config
// ---------------------------------------------------------------------------
const DEFAULT_PIPELINE = createPipelineConfig({
  phases: ["spec", "plan", "code", "test", "review"],
  transitions: [
    { from: "spec", to: "plan" },
    { from: "plan", to: "code" },
    { from: "code", to: "test" },
    { from: "test", to: "review" },
  ],
  roleMapping: [
    { phase: "spec", role: ROLES.PRODUCT },
    { phase: "plan", role: ROLES.ARCHITECT },
    { phase: "code", role: ROLES.DEVELOPER },
    { phase: "test", role: ROLES.OPS },
    { phase: "review", role: ROLES.REVIEWER },
  ],
})

// ---------------------------------------------------------------------------
// Mock file system (for test mode)
// ---------------------------------------------------------------------------
function createMockFileSystem(): FileSystem {
  const store = new Map<string, string>()
  return {
    async read(path: string) {
      const content = store.get(path)
      if (content === undefined) throw new Error(`File not found: ${path}`)
      return content
    },
    async write(path: string, content: string) { store.set(path, content) },
    async edit(path: string, oldContent: string, newContent: string) {
      const existing = store.get(path) ?? ""
      store.set(path, existing.replace(oldContent, newContent))
    },
    async glob(_pattern: string) { return Array.from(store.keys()) },
    async exists(path: string) { return store.has(path) },
  }
}

function createMockShell(): ShellExecutor {
  return {
    async execute(_command: string, _args: readonly string[], _timeout?: number) {
      return { stdout: "10 passed, 0 failed", stderr: "", exitCode: 0 }
    },
  }
}

// ---------------------------------------------------------------------------
// Load system prompt with fallback
// ---------------------------------------------------------------------------
function loadPrompt(role: string, fallback: string): string {
  try {
    // Dynamic require to avoid bundling issues; readFileSync is fine for startup
    const { readFileSync } = require("node:fs") as typeof import("node:fs")
    const { join } = require("node:path") as typeof import("node:path")
    const promptPath = join(process.cwd(), "agent-prompts", `${role}.md`)
    return readFileSync(promptPath, "utf-8")
  } catch {
    return fallback
  }
}

// ---------------------------------------------------------------------------
// buildSystem: wire all dependencies
// ---------------------------------------------------------------------------
export async function buildSystem(config: DevFleetConfig): Promise<DevFleetSystem> {
  const useMock = config.mockMode ?? false
  const maxRetries = config.maxRetries ?? 2
  const pipelineTimeoutMs = config.pipelineTimeoutMs ?? 300_000 // 5 min

  // -------------------------------------------------------------------------
  // 1. Storage
  // -------------------------------------------------------------------------
  const taskRepo = new InMemoryTaskRepo()
  const goalRepo = new InMemoryGoalRepo()
  const agentRegistry = new InMemoryAgentRegistry()
  const eventStore = new InMemoryEventStore()
  const metricRecorder = new InMemoryMetricRecorder()
  const artifactRepo = new InMemoryArtifactRepo()
  const keepDiscardRepo = new InMemoryKeepDiscardRepository()
  const insightRepo = new InMemoryInsightRepository()
  const budgetConfigStore = new InMemoryBudgetConfigStore()
  const alertPreferencesStore = new InMemoryAlertPreferencesStore()
  const agentPromptStore = new FileSystemAgentPromptStore(join(config.workspaceDir, "agent-prompts"))
  const skillStore = new FileSystemSkillStore(join(config.workspaceDir, "skills"))
  const notificationPort = new NoOpNotificationAdapter()

  // -------------------------------------------------------------------------
  // 2. Infrastructure
  // -------------------------------------------------------------------------
  const bus = new InMemoryBus()

  const fileSystem: FileSystem = useMock ? createMockFileSystem() : new NodeFileSystem(config.workspaceDir)
  const shell: ShellExecutor = useMock ? createMockShell() : new NodeShellExecutor(config.workspaceDir)

  const detectProjectConfig = new DetectProjectConfig(fileSystem)

  const agentSession: AgentSession = useMock
    ? new MockAgentSession()
    : new ClaudeAgentSdkAdapter()

  // -------------------------------------------------------------------------
  // 3. Worktree manager (in-memory for test, NodeWorktreeManager for production)
  // -------------------------------------------------------------------------
  const worktreeManager = useMock
    ? new InMemoryWorktreeManager()
    : new NodeWorktreeManager(shell, config.workspaceDir)

  // -------------------------------------------------------------------------
  // 4. Use cases
  // -------------------------------------------------------------------------
  const checkBudget = new CheckBudget(taskRepo)
  const recordTurnMetrics = new RecordTurnMetrics(metricRecorder, taskRepo)
  const evaluateOutcome = new EvaluateOutcome(taskRepo, bus)
  const decomposeGoal = new DecomposeGoal(goalRepo, taskRepo, bus)
  const assignTask = new AssignTask(taskRepo, agentRegistry, bus)
  const evaluateKeepDiscard = new EvaluateKeepDiscard(taskRepo)
  const mergeBranch = new MergeBranch(taskRepo, worktreeManager, bus)
  const discardBranch = new DiscardBranch(taskRepo, worktreeManager, bus)
  const createArtifact = new CreateArtifactUseCase(artifactRepo, taskRepo)
  const detectStuckAgent = new DetectStuckAgent(agentRegistry, bus)
  const computeFinancials = new ComputeFinancials(eventStore)
  const computeQuality = new ComputeQualityMetrics(keepDiscardRepo)
  const computeTimings = new ComputePhaseTimings(eventStore, taskRepo)
  const acceptInsight = new AcceptInsight(insightRepo, agentPromptStore, budgetConfigStore, agentRegistry, skillStore, bus, notificationPort)
  const dismissInsight = new DismissInsight(insightRepo)
  const agentTimeoutMs = config.agentTimeoutMs ?? 300_000 // 5 min

  // -------------------------------------------------------------------------
  // 5. Agent executor and build/test use cases
  // -------------------------------------------------------------------------
  const agentExecutor = new RunAgentSession(
    agentSession, checkBudget, recordTurnMetrics, evaluateOutcome, bus,
  )

  const buildCommand = config.buildCommand ?? "npm run build"
  const testCommand = config.testCommand ?? "npm test"
  const runBuildAndTest = new RunBuildAndTest(shell, taskRepo, recordTurnMetrics, bus)

  const shellFactory: ShellExecutorFactory = useMock
    ? (_path: string): ShellExecutor => createMockShell()
    : (path: string): ShellExecutor => new NodeShellExecutor(path)

  // -------------------------------------------------------------------------
  // 6. Agent IDs and models
  // -------------------------------------------------------------------------
  const projectId = createProjectId(config.projectId)
  const supervisorModel = config.supervisorModel ?? "claude-3-5-sonnet-20241022"
  const developerModel = config.developerModel ?? "claude-3-5-sonnet-20241022"
  const reviewerModel = config.reviewerModel ?? "claude-3-5-sonnet-20241022"

  const supervisorId = createAgentId("supervisor-1")
  const productId = createAgentId("product-1")
  const architectId = createAgentId("architect-1")
  const developerId = createAgentId("developer-1")
  const reviewerId = createAgentId("reviewer-1")
  const opsId = createAgentId("ops-1")
  const learnerId = createAgentId("learner-1")

  // Register all agents
  const agentDefs = [
    { id: supervisorId, role: ROLES.SUPERVISOR, model: supervisorModel },
    { id: productId, role: ROLES.PRODUCT, model: developerModel },
    { id: architectId, role: ROLES.ARCHITECT, model: developerModel },
    { id: developerId, role: ROLES.DEVELOPER, model: developerModel },
    { id: reviewerId, role: ROLES.REVIEWER, model: reviewerModel },
    { id: opsId, role: ROLES.OPS, model: "deterministic" },
    { id: learnerId, role: ROLES.LEARNER, model: "none" },
  ]

  for (const def of agentDefs) {
    await agentRegistry.register(createAgent(def))
  }

  // -------------------------------------------------------------------------
  // 7. System prompts
  // -------------------------------------------------------------------------
  const supervisorPrompt = loadPrompt("supervisor", "You are a supervisor agent that decomposes goals into tasks.")
  const productPrompt = loadPrompt("product", "You are a product agent that writes requirement specs.")
  const architectPrompt = loadPrompt("architect", "You are an architect agent that creates implementation plans.")
  const developerPrompt = loadPrompt("developer", "You are a skilled software developer agent.")
  const reviewerPrompt = loadPrompt("reviewer", "You are a code reviewer agent. Respond with APPROVED or list issues.")
  // Ops uses a deterministic executor, no system prompt needed

  // -------------------------------------------------------------------------
  // 8. Plugins
  // -------------------------------------------------------------------------
  const supervisorPlugin = new SupervisorPlugin({
    agentId: supervisorId,
    projectId,
    bus,
    taskRepo,
    goalRepo,
    agentRegistry,
    decomposeGoal,
    assignTask,
    agentSession,
    evaluateKeepDiscard,
    mergeBranch,
    discardBranch,
    pipelineConfig: DEFAULT_PIPELINE,
    maxRetries,
    model: supervisorModel,
    systemPrompt: supervisorPrompt,
    detectProjectConfig,
    workspaceDir: config.workspaceDir,
  })

  const productPlugin = new ProductPlugin({
    agentId: productId,
    projectId,
    executor: agentExecutor,
    taskRepo,
    artifactRepo,
    createArtifact,
    bus,
    systemPrompt: productPrompt,
    model: developerModel,
    workspaceDir: config.workspaceDir,
  })

  const architectPlugin = new ArchitectPlugin({
    agentId: architectId,
    projectId,
    executor: agentExecutor,
    taskRepo,
    artifactRepo,
    createArtifact,
    bus,
    systemPrompt: architectPrompt,
    model: developerModel,
    workspaceDir: config.workspaceDir,
  })

  const developerPlugin = new DeveloperPlugin({
    agentId: developerId,
    projectId,
    executor: agentExecutor,
    taskRepo,
    systemPrompt: developerPrompt,
    model: developerModel,
    bus,
    worktreeManager,
    workspaceDir: config.workspaceDir,
  })

  const reviewerPlugin = new ReviewerPlugin({
    agentId: reviewerId,
    projectId,
    executor: agentExecutor,
    taskRepo,
    artifactRepo,
    createArtifact,
    bus,
    systemPrompt: reviewerPrompt,
    model: reviewerModel,
    workspaceDir: config.workspaceDir,
  })

  const opsPlugin = new OpsPlugin({
    agentId: opsId,
    projectId,
    runBuildAndTest,
    taskRepo,
    artifactRepo,
    createArtifact,
    bus,
    buildCommand,
    testCommand,
  })

  const learnerPlugin = new LearnerPlugin({
    agentId: learnerId,
    bus,
    taskRepo,
    keepDiscardRepo,
  })

  // -------------------------------------------------------------------------
  // 9. Plugin registry
  // -------------------------------------------------------------------------
  const pluginRegistry = new PluginRegistry(bus)

  const allPlugins = [
    supervisorPlugin,
    productPlugin,
    architectPlugin,
    developerPlugin,
    reviewerPlugin,
    opsPlugin,
    learnerPlugin,
  ]

  for (const plugin of allPlugins) {
    pluginRegistry.register({
      identity: plugin,
      lifecycle: plugin,
      messageHandler: plugin,
    })
  }

  // -------------------------------------------------------------------------
  // 10. Dashboard dependencies (Phase 3 HTTP API layer)
  // -------------------------------------------------------------------------
  const createGoalFromCeo = new CreateGoalFromCeo(goalRepo, bus)
  const pauseAgentUseCase = new PauseAgent(agentRegistry, bus)
  const liveFloorPresenter = new LiveFloorPresenter(agentRegistry, taskRepo, eventStore)
  const pipelinePresenter = new PipelinePresenter(taskRepo, goalRepo, DEFAULT_PIPELINE.phases)
  const metricsPresenter = new MetricsPresenter(taskRepo, computeFinancials)
  const sseManager = new SSEManager(bus)

  // Universal event persistence: persist every bus message as a SystemEvent
  bus.subscribe({}, async (message) => {
    await eventStore.append(toSystemEvent(message))
  })

  // Alert rules: evaluate incoming messages and generate CEO alerts
  const alertRules: ReadonlyArray<AlertRule> = [
    { trigger: "goal.completed", severity: "info", evaluate: (msg) => ({ severity: "info", title: "Goal completed", body: "Goal finished", goalId: "goalId" in msg ? (msg as any).goalId : undefined }) },
    { trigger: "agent.stuck", severity: "warning", evaluate: (msg) => ({ severity: "warning", title: "Agent stuck", body: "Agent stuck after retries", taskId: "taskId" in msg ? (msg as any).taskId : undefined }) },
    { trigger: "budget.exceeded", severity: "warning", evaluate: (msg) => ({ severity: "warning", title: "Budget exceeded", body: "Task exceeded budget", taskId: "taskId" in msg ? (msg as any).taskId : undefined }) },
    { trigger: "review.rejected", severity: "urgent", evaluate: (msg) => { if (!("retryCount" in msg) || (msg as any).retryCount < 3) return null; return { severity: "urgent", title: "Rejection loop", body: "Task rejected 3+ times", taskId: "taskId" in msg ? (msg as any).taskId : undefined } } },
    { trigger: "insight.generated", severity: "info", evaluate: (msg) => ({ severity: "info", title: "New recommendation", body: "Learner has a suggestion", insightId: "insightId" in msg ? (msg as any).insightId : undefined }) },
    { trigger: "insight.accepted", severity: "info", evaluate: (msg) => ({ severity: "info", title: "Insight applied", body: "title" in msg ? (msg as any).title : "Applied", insightId: "insightId" in msg ? (msg as any).insightId : undefined }) },
  ]
  const evaluateAlert = new EvaluateAlert(notificationPort, alertPreferencesStore, bus, alertRules)
  bus.subscribe({ types: alertRules.map(r => r.trigger) }, (message) => evaluateAlert.execute(message))

  // -------------------------------------------------------------------------
  // 10b. Workspace run management
  // -------------------------------------------------------------------------
  const workspaceRunRepo = new InMemoryWorkspaceRunRepository()
  const workspaceIsolator = new GitCloneIsolator(shellFactory)
  const gitRemote = new NodeGitRemote(shellFactory)
  const prCreator = new GitHubPullRequestCreator(shellFactory)
  const autoMerge = process.env["DEVFLEET_AUTO_MERGE"] === "true"
  const workspaceManager = new WorkspaceRunManager({
    repo: workspaceRunRepo,
    isolator: workspaceIsolator,
    fsFactory: (rootPath: string) => new NodeFileSystem(rootPath),
    gitRemote,
    prCreator,
    autoMerge,
    buildSystem,
    mockMode: useMock,
  })

  const dashboardDeps: DashboardDeps = {
    agentRegistry,
    goalRepo,
    taskRepo,
    eventStore,
    createGoal: createGoalFromCeo,
    pauseAgent: pauseAgentUseCase,
    liveFloor: liveFloorPresenter,
    pipeline: pipelinePresenter,
    metrics: metricsPresenter,
    sseManager,
    pluginRegistry,
    insightRepo,
    acceptInsight,
    dismissInsight,
    computeFinancials,
    computeQuality: computeQuality,
    computeTimings: computeTimings,
    alertPreferencesStore,
    workspaceManager,
    workspaceRunRepo,
  }

  // I2: DetectStuckAgent runs on an interval so stuck agents are caught without polling.
  // The handle is captured so stop() can cancel it cleanly.
  let stuckAgentInterval: ReturnType<typeof setInterval> | null = null

  return {
    taskRepo,
    goalRepo,
    agentRegistry,
    eventStore,
    metricRecorder,
    artifactRepo,
    bus,
    pluginRegistry,
    pipelineTimeoutMs,
    dashboardDeps,
    start: async () => {
      await pluginRegistry.startAll()
      stuckAgentInterval = setInterval(
        () => { void detectStuckAgent.execute(agentTimeoutMs) },
        agentTimeoutMs,
      )
    },
    stop: async () => {
      if (stuckAgentInterval !== null) {
        clearInterval(stuckAgentInterval)
        stuckAgentInterval = null
      }
      await workspaceManager.stopAll()
      await worktreeManager.cleanupAll()
      sseManager.shutdown()
      await pluginRegistry.stopAll()
    },
  }
}
