// src/use-cases/AcceptInsight.ts
import type { InsightRepository } from "./ports/InsightRepository"
import type { AgentPromptStore } from "./ports/AgentPromptStore"
import type { BudgetConfigStore } from "./ports/BudgetConfigStore"
import type { AgentRegistry } from "./ports/AgentRegistry"
import type { SkillStore } from "./ports/SkillStore"
import type { MessagePort } from "./ports/MessagePort"
import type { NotificationPort } from "./ports/NotificationPort"
import type { InsightId } from "../entities/ids"
import { createMessageId } from "../entities/ids"

export class AcceptInsight {
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
    const insight = await this.insightRepo.findById(insightId)
    if (!insight) throw new Error(`Insight ${insightId} not found`)
    if (insight.status !== "pending") throw new Error(`Insight ${insightId} is ${insight.status}, not pending`)

    const action = insight.proposedAction
    switch (action.kind) {
      case "prompt_update":
        await this.promptStore.update(action.role, action.newContent, insight.title)
        break
      case "budget_tune":
        await this.budgetConfigStore.update(action.role, action.newMaxTokens, action.newMaxCostUsd)
        break
      case "model_reassign": {
        const agents = await this.agentRegistry.findAll()
        const agent = agents.find(a => a.role === action.role)
        if (agent) await this.agentRegistry.updateModel(agent.id, action.newModel)
        break
      }
      case "skill_update":
        await this.skillStore.update(action.skillName, action.newContent, insight.title)
        break
      case "process_change":
        break
    }

    await this.insightRepo.update({ ...insight, status: "applied", resolvedAt: new Date() })
    await this.bus.emit({ id: createMessageId(), type: "insight.accepted", insightId: insight.id, actionKind: action.kind, title: insight.title, timestamp: new Date() })
    await this.notificationPort.notify({ severity: "info", title: "Insight applied", body: insight.title, insightId: insight.id })
  }
}
