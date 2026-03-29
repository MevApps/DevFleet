// src/components/inspector/__tests__/agent-inspector.test.tsx
import { describe, it, expect, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { AgentInspector } from "../agent-inspector"
import { useDashboardStore } from "@/lib/store"
import type { AgentDTO } from "@/lib/types"

const makeAgent = (overrides?: Partial<AgentDTO>): AgentDTO => ({
  id: "dev-03", role: "developer", status: "busy", currentTaskId: "t-1",
  model: "claude-sonnet-4-6", lastActiveAt: "2026-03-29T14:32:00Z", ...overrides,
})

describe("AgentInspector", () => {
  beforeEach(() => {
    useDashboardStore.setState({
      agents: [makeAgent()],
      recentEvents: [],
    })
  })

  it("renders agent role", () => {
    render(<AgentInspector entityId="dev-03" />)
    expect(screen.getByText("developer")).toBeInTheDocument()
  })

  it("renders agent model", () => {
    render(<AgentInspector entityId="dev-03" />)
    expect(screen.getByText("claude-sonnet-4-6")).toBeInTheDocument()
  })

  it("renders current task link", () => {
    render(<AgentInspector entityId="dev-03" />)
    expect(screen.getByText(/t-1/)).toBeInTheDocument()
  })

  it("renders pause button for busy agent", () => {
    render(<AgentInspector entityId="dev-03" />)
    expect(screen.getByText(/pause/i)).toBeInTheDocument()
  })

  it("renders resume button for paused agent", () => {
    useDashboardStore.setState({ agents: [makeAgent({ status: "paused" })] })
    render(<AgentInspector entityId="dev-03" />)
    expect(screen.getByText(/resume/i)).toBeInTheDocument()
  })

  it("shows not found for missing agent", () => {
    render(<AgentInspector entityId="nonexistent" />)
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })
})
