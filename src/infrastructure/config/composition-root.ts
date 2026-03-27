import { InMemoryTaskRepo } from "../../adapters/storage/InMemoryTaskRepo"
import { InMemoryGoalRepo } from "../../adapters/storage/InMemoryGoalRepo"
import { InMemoryAgentRegistry } from "../../adapters/storage/InMemoryAgentRegistry"
import { InMemoryEventStore } from "../../adapters/storage/InMemoryEventStore"
import { InMemoryMetricRecorder } from "../../adapters/storage/InMemoryMetricRecorder"
import { InMemoryArtifactRepo } from "../../adapters/storage/InMemoryArtifactRepo"
import { InMemoryWorktreeManager } from "../../adapters/storage/InMemoryWorktreeManager"
import { InMemoryBus } from "../../adapters/messaging/InMemoryBus"
import { NodeFileSystem } from "../../adapters/filesystem/NodeFileSystem"
import { NodeShellExecutor } from "../../adapters/shell/NodeShellExecutor"
import { ClaudeProvider } from "../../adapters/ai-providers/ClaudeProvider"
import { DeterministicProvider } from "../../adapters/ai-providers/DeterministicProvider"
import { PluginRegistry } from "../../adapters/plugins/PluginRegistry"
import { SupervisorPlugin } from "../../adapters/plugins/agents/SupervisorPlugin"
import { ProductPlugin } from "../../adapters/plugins/agents/ProductPlugin"
import { ArchitectPlugin } from "../../adapters/plugins/agents/ArchitectPlugin"
import { DeveloperPlugin } from "../../adapters/plugins/agents/DeveloperPlugin"
import { ReviewerPlugin } from "../../adapters/plugins/agents/ReviewerPlugin"
import { OpsPlugin } from "../../adapters/plugins/agents/OpsPlugin"
import { LearnerPlugin } from "../../adapters/plugins/agents/LearnerPlugin"
import { CheckBudget } from "../../use-cases/CheckBudget"
import { PromptAgent } from "../../use-cases/PromptAgent"
import { ExecuteToolCalls } from "../../use-cases/ExecuteToolCalls"
import { RecordTurnMetrics } from "../../use-cases/RecordTurnMetrics"
import { EvaluateTurnOutcome } from "../../use-cases/EvaluateTurnOutcome"
import { RunAgentLoop } from "../../use-cases/RunAgentLoop"
import { DecomposeGoal } from "../../use-cases/DecomposeGoal"
import { AssignTask } from "../../use-cases/AssignTask"
import { EvaluateKeepDiscard } from "../../use-cases/EvaluateKeepDiscard"
import { MergeBranch } from "../../use-cases/MergeBranch"
import { DiscardBranch } from "../../use-cases/DiscardBranch"
import { CreateArtifactUseCase } from "../../use-cases/CreateArtifact"
import { DetectStuckAgent } from "../../use-cases/DetectStuckAgent"
import { createAgentId, createProjectId } from "../../entities/ids"
import { createAgent } from "../../entities/Agent"
import { ROLES } from "../../entities/AgentRole"
import { createPipelineConfig } from "../../entities/PipelineConfig"
import type {
  AICompletionProvider,
  AIToolProvider,
  AICapability,
  AgentPrompt,
  AIResponse,
  AIToolResponse,
  ToolDefinition,
} from "../../use-cases/ports/AIProvider"
import type { TokenBudget } from "../../entities/Budget"
import type { FileSystem } from "../../use-cases/ports/FileSystem"
import type { ShellExecutor } from "../../use-cases/ports/ShellExecutor"
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
  readonly anthropicApiKey?: string
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
// Mock AI provider for testing (no API key)
// ---------------------------------------------------------------------------
class MockAIProvider implements AICompletionProvider, AIToolProvider {
  readonly capabilities: ReadonlySet<AICapability> = new Set(["tool_use"])

  async complete(_prompt: AgentPrompt, _budget: TokenBudget): Promise<AIResponse> {
    const content = this.generateResponse(_prompt.systemPrompt)
    return { content, tokensIn: 10, tokensOut: 20, stopReason: "end_turn" }
  }

  async completeWithTools(
    _prompt: AgentPrompt,
    _tools: ReadonlyArray<ToolDefinition>,
    _budget: TokenBudget,
  ): Promise<AIToolResponse> {
    const content = this.generateResponse(_prompt.systemPrompt)
    return { content, toolCalls: [], tokensIn: 10, tokensOut: 20, stopReason: "end_turn" }
  }

  private generateResponse(systemPrompt: string): string {
    // Return role-appropriate canned responses based on the system prompt
    const lower = systemPrompt.toLowerCase()

    if (lower.includes("decompose") || lower.includes("supervisor")) {
      return JSON.stringify([
        { description: "Write requirement spec", phase: "spec" },
        { description: "Create implementation plan", phase: "plan" },
        { description: "Implement the feature", phase: "code" },
        { description: "Run build and tests", phase: "test" },
        { description: "Review the implementation", phase: "review" },
      ])
    }

    if (lower.includes("product") || lower.includes("requirement")) {
      return "# Requirement Spec\n\n1. The system shall implement the requested feature.\n\nSuccess Criteria:\n- Feature works as described"
    }

    if (lower.includes("architect") || lower.includes("plan")) {
      return "# Implementation Plan\n\n## Step 1: Create module\nCreate the main module.\n\n## Step 2: Add tests\nAdd unit tests."
    }

    if (lower.includes("developer") || lower.includes("implement")) {
      return "Implementation complete. Created the requested feature with tests."
    }

    if (lower.includes("review") || lower.includes("evaluate")) {
      return "APPROVED - Code meets requirements and follows best practices."
    }

    if (lower.includes("ops") || lower.includes("build")) {
      return "Build OK\n10 passed, 0 failed"
    }

    return "Task completed successfully."
  }
}

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
    async execute(_command: string, _timeout?: number) {
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
  const useMock = !config.anthropicApiKey
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

  // -------------------------------------------------------------------------
  // 2. Infrastructure
  // -------------------------------------------------------------------------
  const bus = new InMemoryBus()

  const fileSystem: FileSystem = useMock ? createMockFileSystem() : new NodeFileSystem(config.workspaceDir)
  const shell: ShellExecutor = useMock ? createMockShell() : new NodeShellExecutor(config.workspaceDir)

  const ai: AICompletionProvider & AIToolProvider = useMock
    ? new MockAIProvider()
    : new ClaudeProvider(config.anthropicApiKey)

  // -------------------------------------------------------------------------
  // 3. Worktree manager (in-memory for now)
  // -------------------------------------------------------------------------
  const worktreeManager = new InMemoryWorktreeManager()

  // -------------------------------------------------------------------------
  // 4. Use cases
  // -------------------------------------------------------------------------
  const checkBudget = new CheckBudget(taskRepo)
  const promptAgent = new PromptAgent(ai, ai)
  const executeToolCalls = new ExecuteToolCalls(fileSystem, shell)
  const recordTurnMetrics = new RecordTurnMetrics(metricRecorder, taskRepo)
  const evaluateTurnOutcome = new EvaluateTurnOutcome(taskRepo, bus)
  const decomposeGoal = new DecomposeGoal(goalRepo, taskRepo, bus)
  const assignTask = new AssignTask(taskRepo, agentRegistry, bus)
  const evaluateKeepDiscard = new EvaluateKeepDiscard(taskRepo)
  const mergeBranch = new MergeBranch(taskRepo, worktreeManager, bus)
  const discardBranch = new DiscardBranch(taskRepo, worktreeManager, bus)
  const createArtifact = new CreateArtifactUseCase(artifactRepo, taskRepo)
  const detectStuckAgent = new DetectStuckAgent(agentRegistry, bus)
  const agentTimeoutMs = config.agentTimeoutMs ?? 300_000 // 5 min

  // -------------------------------------------------------------------------
  // 5. One RunAgentLoop per agent tier (different AI + tool configurations)
  // -------------------------------------------------------------------------
  const agentExecutor = new RunAgentLoop(
    checkBudget,
    promptAgent,
    executeToolCalls,
    recordTurnMetrics,
    evaluateTurnOutcome,
    taskRepo,
  )

  // Ops executor: DeterministicProvider drives build/test commands deterministically.
  // Using a separate RunAgentLoop ensures Ops never routes through the shared AI provider.
  const buildCommand = config.buildCommand ?? "npm run build"
  const testCommand = config.testCommand ?? "npm test"
  const opsProvider = useMock
    ? new MockAIProvider()
    : new DeterministicProvider([
        { name: "shell_run", input: { command: buildCommand } },
        { name: "shell_run", input: { command: testCommand } },
      ])
  const opsPromptAgent = new PromptAgent(opsProvider, opsProvider)
  const opsExecuteToolCalls = new ExecuteToolCalls(fileSystem, shell)
  const opsExecutor = new RunAgentLoop(
    checkBudget,
    opsPromptAgent,
    opsExecuteToolCalls,
    recordTurnMetrics,
    evaluateTurnOutcome,
    taskRepo,
  )

  // Scoped executor factory: DeveloperPlugin calls this with the worktree path to get
  // a RunAgentLoop whose FileSystem and ShellExecutor are rooted at that directory.
  // The factory is the Layer 4 abstraction — the plugin receives a port, not concrete classes.
  const fsFactory = useMock
    ? (_path: string): FileSystem => createMockFileSystem()
    : (path: string): FileSystem => new NodeFileSystem(path)
  const shellFactory = useMock
    ? (_path: string): ShellExecutor => createMockShell()
    : (path: string): ShellExecutor => new NodeShellExecutor(path)

  const scopedExecutorFactory = (workingDir: string): RunAgentLoop => {
    const scopedFs = fsFactory(workingDir)
    const scopedShell = shellFactory(workingDir)
    const scopedExecuteToolCalls = new ExecuteToolCalls(scopedFs, scopedShell)
    return new RunAgentLoop(
      checkBudget,
      promptAgent,
      scopedExecuteToolCalls,
      recordTurnMetrics,
      evaluateTurnOutcome,
      taskRepo,
    )
  }

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
    promptAgent,
    evaluateKeepDiscard,
    mergeBranch,
    discardBranch,
    pipelineConfig: DEFAULT_PIPELINE,
    maxRetries,
    model: supervisorModel,
    systemPrompt: supervisorPrompt,
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
    scopedExecutorFactory,
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
  })

  const opsPlugin = new OpsPlugin({
    agentId: opsId,
    projectId,
    executor: opsExecutor,
    taskRepo,
    artifactRepo,
    createArtifact,
    bus,
  })

  const learnerPlugin = new LearnerPlugin({
    agentId: learnerId,
    bus,
    eventStore,
    taskRepo,
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
      await pluginRegistry.stopAll()
    },
  }
}
