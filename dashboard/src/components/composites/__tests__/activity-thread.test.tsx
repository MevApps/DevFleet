// src/components/composites/__tests__/activity-thread.test.tsx
import { describe, it, expect } from "vitest"
import { render, screen } from "@testing-library/react"
import { ActivityThread } from "../activity-thread"
import type { EventDTO } from "@/lib/types"

const makeEvent = (overrides: Partial<EventDTO>): EventDTO => ({
  id: "e-1", type: "task.completed", agentId: "dev-01",
  taskId: "t-1", goalId: "g-1", occurredAt: "2026-03-29T14:32:12Z",
  ...overrides,
})

describe("ActivityThread", () => {
  it("renders event type text", () => {
    render(<ActivityThread events={[makeEvent({ type: "task.completed" })]} />)
    expect(screen.getByText("task.completed")).toBeInTheDocument()
  })

  it("renders multiple events in order", () => {
    const events = [
      makeEvent({ id: "e-1", type: "task.assigned", occurredAt: "2026-03-29T14:32:12Z" }),
      makeEvent({ id: "e-2", type: "task.completed", occurredAt: "2026-03-29T14:30:00Z" }),
    ]
    render(<ActivityThread events={events} />)
    expect(screen.getByText("task.assigned")).toBeInTheDocument()
    expect(screen.getByText("task.completed")).toBeInTheDocument()
  })

  it("shows empty message when no events", () => {
    render(<ActivityThread events={[]} />)
    expect(screen.getByText(/no activity/i)).toBeInTheDocument()
  })

  it("shows agent ID when present", () => {
    render(<ActivityThread events={[makeEvent({ agentId: "dev-03" })]} />)
    expect(screen.getByText("dev-03")).toBeInTheDocument()
  })
})
