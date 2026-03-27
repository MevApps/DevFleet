import type { AICompletionProvider } from "./ports/AIProvider"
import type { ComputeFinancials } from "./ComputeFinancials"
import type { ComputeQualityMetrics } from "./ComputeQualityMetrics"
import type { ComputePhaseTimings } from "./ComputePhaseTimings"
import type { InsightRepository } from "./ports/InsightRepository"
import type { NotificationPort } from "./ports/NotificationPort"
import type { MessagePort } from "./ports/MessagePort"
import type { AgentPromptStore } from "./ports/AgentPromptStore"
import type { BudgetConfigStore } from "./ports/BudgetConfigStore"
import type { AgentRegistry } from "./ports/AgentRegistry"
import type { SkillStore } from "./ports/SkillStore"
import type { ProposedAction } from "../entities/Insight"
import { createInsight } from "../entities/Insight"
import { createInsightId, createMessageId } from "../entities/ids"

interface RawRecommendation {
  title: string
  description: string
  evidence: string
  confidence: string
  proposedAction: {
    kind: string
    role?: string
    newContent?: string
    newMaxTokens?: number
    newMaxCostUsd?: number
    newModel?: string
    skillName?: string
    description?: string
  }
}

export class RunAnalysisCycle {
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
    private readonly promptStore: AgentPromptStore,
    private readonly budgetConfigStore: BudgetConfigStore,
    private readonly agentRegistry: AgentRegistry,
    private readonly skillStore: SkillStore,
  ) {}

  async execute(): Promise<void> {
    const [financials, quality, timings] = await Promise.all([
      this.computeFinancials.execute(),
      this.computeQuality.execute(),
      this.computeTimings.execute(),
    ])

    const agents = await this.agentRegistry.findAll()
    const currentConfig: Record<string, unknown> = {}
    for (const agent of agents) {
      try {
        const prompt = await this.promptStore.read(agent.role)
        const budget = await this.budgetConfigStore.read(agent.role)
        currentConfig[agent.role as string] = { prompt, budget, model: agent.model }
      } catch { /* role may not have a prompt file */ }
    }

    const context = JSON.stringify({ financials, quality, timings, currentConfig }, null, 2)
    const response = await this.ai.complete(
      { systemPrompt: this.systemPrompt, messages: [{ role: "user", content: context }], model: this.model, maxTokens: 4096 },
      { maxTokens: 100000, maxCostUsd: 10, remaining: 100000 },
    )

    let recommendations: RawRecommendation[]
    try {
      recommendations = JSON.parse(response.content)
      if (!Array.isArray(recommendations)) return
    } catch { return }

    for (const rec of recommendations) {
      const action = await this.buildProposedAction(rec, currentConfig)
      if (!action) continue

      const insight = createInsight({
        id: createInsightId(),
        title: rec.title,
        description: rec.description,
        evidence: rec.evidence,
        proposedAction: action,
      })

      await this.insightRepo.save(insight)
      await this.bus.emit({
        id: createMessageId(),
        type: "insight.generated",
        insightId: insight.id,
        actionKind: action.kind,
        title: rec.title,
        confidence: rec.confidence === "high" ? 1 : rec.confidence === "medium" ? 0.5 : 0.2,
        timestamp: new Date(),
      })

      if (rec.confidence === "high") {
        await this.notificationPort.notify({ severity: "info", title: "New recommendation", body: rec.title, insightId: insight.id })
      }
    }
  }

  private async buildProposedAction(rec: RawRecommendation, currentConfig: Record<string, unknown>): Promise<ProposedAction | null> {
    const pa = rec.proposedAction
    const config = pa.role ? (currentConfig[pa.role] as { prompt?: string; budget?: { maxTokens: number; maxCostUsd: number }; model?: string } | undefined) : undefined

    switch (pa.kind) {
      case "prompt_update":
        if (!pa.role || !pa.newContent) return null
        return { kind: "prompt_update", role: pa.role, currentContent: config?.prompt ?? "", newContent: pa.newContent }
      case "budget_tune":
        if (!pa.role || pa.newMaxTokens === undefined || pa.newMaxCostUsd === undefined) return null
        return { kind: "budget_tune", role: pa.role, currentMaxTokens: config?.budget?.maxTokens ?? 0, currentMaxCostUsd: config?.budget?.maxCostUsd ?? 0, newMaxTokens: pa.newMaxTokens, newMaxCostUsd: pa.newMaxCostUsd }
      case "model_reassign":
        if (!pa.role || !pa.newModel) return null
        return { kind: "model_reassign", role: pa.role, currentModel: config?.model ?? "", newModel: pa.newModel }
      case "skill_update": {
        if (!pa.skillName || !pa.newContent) return null
        let currentContent = ""
        try { currentContent = await this.skillStore.read(pa.skillName) } catch { /* skill may not exist yet */ }
        return { kind: "skill_update", skillName: pa.skillName, currentContent, newContent: pa.newContent }
      }
      case "process_change":
        return { kind: "process_change", description: pa.description ?? rec.description }
      default:
        return null
    }
  }
}
