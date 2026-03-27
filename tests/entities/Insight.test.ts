import { createInsight, type ProposedAction } from "@entities/Insight"
import { createInsightId } from "@entities/ids"

describe("Insight", () => {
  it("creates with pending status and null timestamps", () => {
    const action: ProposedAction = { kind: "prompt_update", role: "developer", currentContent: "old", newContent: "new" }
    const insight = createInsight({ id: createInsightId(), title: "Fix dev prompt", description: "Add lint", evidence: "4/6 rejected for lint", proposedAction: action })
    expect(insight.status).toBe("pending")
    expect(insight.outcomeMetric).toBeNull()
    expect(insight.resolvedAt).toBeNull()
    expect(insight.proposedAction.kind).toBe("prompt_update")
  })

  it("preserves ProposedAction snapshot data", () => {
    const action: ProposedAction = { kind: "budget_tune", role: "developer", currentMaxTokens: 10000, currentMaxCostUsd: 1.0, newMaxTokens: 7000, newMaxCostUsd: 0.7 }
    const insight = createInsight({ id: createInsightId(), title: "Lower dev budget", description: "desc", evidence: "data", proposedAction: action })
    expect(insight.proposedAction).toEqual(action)
  })
})
