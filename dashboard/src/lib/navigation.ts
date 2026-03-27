export interface NavItem {
  href: string
  label: string
  icon: string
}

export interface NavSection {
  title: string
  items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Overview",
    items: [
      { href: "/", label: "Live Floor", icon: "Radio" },
    ],
  },
  {
    title: "Workflow",
    items: [
      { href: "/pipeline", label: "Pipeline", icon: "Columns3" },
      { href: "/goals", label: "Goals", icon: "Target" },
    ],
  },
  {
    title: "Entities",
    items: [
      { href: "/agents", label: "Agents", icon: "Bot" },
      { href: "/tasks", label: "Tasks", icon: "CheckSquare" },
      { href: "/events", label: "Events", icon: "Activity" },
    ],
  },
  {
    title: "Analytics",
    items: [
      { href: "/financials", label: "Financials", icon: "DollarSign" },
      { href: "/quality", label: "Quality", icon: "ShieldCheck" },
      { href: "/analytics/performance", label: "Performance", icon: "Timer" },
    ],
  },
  {
    title: "System",
    items: [
      { href: "/system", label: "Health", icon: "HeartPulse" },
      { href: "/insights", label: "Insights", icon: "Lightbulb" },
    ],
  },
]

export const PAGE_TITLES: Record<string, string> = {
  "/": "Live Floor",
  "/pipeline": "Pipeline",
  "/goals": "Goals",
  "/agents": "Agents",
  "/tasks": "Tasks",
  "/events": "Events",
  "/financials": "Financials",
  "/quality": "Quality",
  "/analytics/performance": "Performance",
  "/system": "System Health",
  "/insights": "Insights",
}
