import {
  Bot, Target, CheckSquare, FileCode, Activity, BarChart3, Wallet,
  Circle, Radio, Columns3, DollarSign, ShieldCheck, Timer, HeartPulse,
  Lightbulb, Inbox, PanelLeftOpen, PanelLeftClose, Sun, Moon, Bell,
} from "lucide-react"
import type { LucideIcon } from "lucide-react"

const iconMap: Record<string, LucideIcon> = {
  Bot, Target, CheckSquare, FileCode, Activity, BarChart3, Wallet,
  Circle, Radio, Columns3, DollarSign, ShieldCheck, Timer, HeartPulse,
  Lightbulb, Inbox, PanelLeftOpen, PanelLeftClose, Sun, Moon, Bell,
}

export function resolveIcon(name: string): LucideIcon {
  const icon = iconMap[name]
  if (!icon) {
    if (process.env.NODE_ENV === "development") {
      console.warn(`[DevFleet] Unknown icon: "${name}". Falling back to Circle.`)
    }
    return Circle
  }
  return icon
}
