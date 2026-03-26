import { InMemoryTaskRepo } from "../../adapters/storage/InMemoryTaskRepo"
import { InMemoryGoalRepo } from "../../adapters/storage/InMemoryGoalRepo"
import { InMemoryAgentRegistry } from "../../adapters/storage/InMemoryAgentRegistry"
import { InMemoryEventStore } from "../../adapters/storage/InMemoryEventStore"
import { InMemoryMetricRecorder } from "../../adapters/storage/InMemoryMetricRecorder"
import { InMemoryBus } from "../../adapters/messaging/InMemoryBus"
import { NodeFileSystem } from "../../adapters/filesystem/NodeFileSystem"
import { NodeShellExecutor } from "../../adapters/shell/NodeShellExecutor"
import { ClaudeProvider } from "../../adapters/ai-providers/ClaudeProvider"
import { PluginRegistry } from "../../adapters/plugins/PluginRegistry"
import { DeveloperPlugin } from "../../adapters/plugins/agents/DeveloperPlugin"
import { CheckBudget } from "../../use-cases/CheckBudget"
import { PromptAgent } from "../../use-cases/PromptAgent"
import { ExecuteToolCalls } from "../../use-cases/ExecuteToolCalls"
import { RecordTurnMetrics } from "../../use-cases/RecordTurnMetrics"
import { EvaluateTurnOutcome } from "../../use-cases/EvaluateTurnOutcome"
import { RunAgentLoop } from "../../use-cases/RunAgentLoop"
import { createAgentId, createProjectId } from "../../entities/ids"
import { createAgent } from "../../entities/Agent"
import { ROLES } from "../../entities/AgentRole"
import { readFileSync } from "node:fs"
import { join } from "node:path"

export interface DevFleetConfig {
  readonly workspaceDir: string
  readonly anthropicApiKey?: string
  readonly developerModel?: string
  readonly projectId?: string
}

export interface DevFleetSystem {
  readonly taskRepo: InMemoryTaskRepo
  readonly goalRepo: InMemoryGoalRepo
  readonly agentRegistry: InMemoryAgentRegistry
  readonly eventStore: InMemoryEventStore
  readonly metricRecorder: InMemoryMetricRecorder
  readonly bus: InMemoryBus
  readonly pluginRegistry: PluginRegistry
  readonly agentExecutor: RunAgentLoop
  start(): Promise<void>
  stop(): Promise<void>
}

export async function buildSystem(config: DevFleetConfig): Promise<DevFleetSystem> {
  // Storage
  const taskRepo = new InMemoryTaskRepo()
  const goalRepo = new InMemoryGoalRepo()
  const agentRegistry = new InMemoryAgentRegistry()
  const eventStore = new InMemoryEventStore()
  const metricRecorder = new InMemoryMetricRecorder()

  // Infrastructure
  const bus = new InMemoryBus()
  const fileSystem = new NodeFileSystem(config.workspaceDir)
  const shell = new NodeShellExecutor(config.workspaceDir)
  const ai = new ClaudeProvider(config.anthropicApiKey)

  // Use cases
  const checkBudget = new CheckBudget(taskRepo)
  const promptAgent = new PromptAgent(ai, ai)
  const executeToolCalls = new ExecuteToolCalls(fileSystem, shell)
  const recordTurnMetrics = new RecordTurnMetrics(metricRecorder, taskRepo)
  const evaluateTurnOutcome = new EvaluateTurnOutcome(taskRepo, bus)

  // Agent executor (RunAgentLoop wires all use cases)
  const agentExecutor = new RunAgentLoop(
    checkBudget,
    promptAgent,
    executeToolCalls,
    recordTurnMetrics,
    evaluateTurnOutcome,
    taskRepo,
  )

  // Load developer system prompt
  let systemPrompt = "You are a skilled software developer agent."
  try {
    const promptPath = join(process.cwd(), "agent-prompts", "developer.md")
    systemPrompt = readFileSync(promptPath, "utf-8")
  } catch {
    // Use default if file not found
  }

  const model = config.developerModel ?? "claude-3-5-sonnet-20241022"
  const projectId = createProjectId(config.projectId)
  const agentId = createAgentId("developer-1")

  // Register developer agent
  const developerAgent = createAgent({
    id: agentId,
    role: ROLES.DEVELOPER,
    model,
  })
  await agentRegistry.register(developerAgent)

  // Developer plugin
  const developerPlugin = new DeveloperPlugin({
    agentId,
    projectId,
    executor: agentExecutor,
    taskRepo,
    systemPrompt,
    model,
    bus,
  })

  // Plugin registry
  const pluginRegistry = new PluginRegistry(bus)
  pluginRegistry.register({
    identity: developerPlugin,
    lifecycle: developerPlugin,
    messageHandler: developerPlugin,
  })

  return {
    taskRepo,
    goalRepo,
    agentRegistry,
    eventStore,
    metricRecorder,
    bus,
    pluginRegistry,
    agentExecutor,
    start: () => pluginRegistry.startAll(),
    stop: () => pluginRegistry.stopAll(),
  }
}
