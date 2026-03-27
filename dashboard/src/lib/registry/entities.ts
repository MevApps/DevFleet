export interface EntityConfig {
  readonly hue: number
  readonly icon: string
  readonly label: string
}

export const entityRegistry: Record<string, EntityConfig> = {
  agent:    { hue: 210, icon: "Bot",        label: "Agent"    },
  goal:     { hue: 348, icon: "Target",     label: "Goal"     },
  task:     { hue: 125, icon: "CheckSquare", label: "Task"    },
  artifact: { hue: 263, icon: "FileCode",   label: "Artifact" },
  event:    { hue: 40,  icon: "Activity",   label: "Event"    },
  metric:   { hue: 178, icon: "BarChart3",  label: "Metric"   },
  budget:   { hue: 315, icon: "Wallet",     label: "Budget"   },
}

export function getEntityConfig(entity: string): EntityConfig {
  return entityRegistry[entity] ?? { hue: 0, icon: "Circle", label: entity }
}
