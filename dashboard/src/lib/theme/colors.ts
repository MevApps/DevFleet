import type { StatusColor } from "@/lib/registry/statuses"

export function statusClasses(color: StatusColor) {
  return {
    surface: `bg-status-${color}-surface`,
    border: `border-status-${color}-border`,
    fg: `text-status-${color}-fg`,
    bgFg: `bg-status-${color}-fg`,
  } as const
}

export function entityHsl(hue: number, variant: "surface" | "border" | "fg"): string {
  switch (variant) {
    case "surface": return `hsla(${hue}, 70%, 50%, 0.12)`
    case "border":  return `hsla(${hue}, 70%, 50%, 0.3)`
    case "fg":      return `hsl(${hue}, 70%, var(--entity-fg-lightness))`
  }
}
