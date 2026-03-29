import type { ComponentType } from "react"
import { GoalInspector } from "./goal-inspector"
import { TaskInspector } from "./task-inspector"
import { AgentInspector } from "./agent-inspector"
import { EventInspector } from "./event-inspector"

interface InspectorComponentProps {
  entityId: string
}

const INSPECTOR_MAP: Record<string, ComponentType<InspectorComponentProps>> = {
  goal: GoalInspector,
  task: TaskInspector,
  agent: AgentInspector,
  event: EventInspector,
}

export function getInspectorComponent(entityType: string): ComponentType<InspectorComponentProps> | null {
  return INSPECTOR_MAP[entityType] ?? null
}
