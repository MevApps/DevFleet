import { getEntityConfig } from "@/lib/registry/entities"
import { resolveIcon } from "@/lib/registry/icons"
import { entityHsl } from "@/lib/theme/colors"
import { cn } from "@/lib/utils"

interface EntityIconProps {
  entity: string
  size?: "sm" | "md" | "lg"
  className?: string
}

const SIZE = {
  sm: { box: "h-6 w-6", icon: 12, radius: "rounded" },
  md: { box: "h-8 w-8", icon: 16, radius: "rounded-lg" },
  lg: { box: "h-10 w-10", icon: 20, radius: "rounded-lg" },
} as const

export function EntityIcon({ entity, size = "md", className }: EntityIconProps) {
  const config = getEntityConfig(entity)
  const s = SIZE[size]
  const IconComponent = resolveIcon(config.icon)

  return (
    <div
      className={cn("flex items-center justify-center", s.box, s.radius, className)}
      style={{
        backgroundColor: entityHsl(config.hue, "surface"),
        borderWidth: "1px",
        borderColor: entityHsl(config.hue, "border"),
      }}
    >
      <IconComponent size={s.icon} style={{ color: entityHsl(config.hue, "fg") }} />
    </div>
  )
}
