import { resolveIcon } from "@/lib/registry/icons"
import { cn } from "@/lib/utils"

interface EmptyStateProps {
  icon?: string
  title: string
  description: string
  action?: { label: string; onClick: () => void }
  className?: string
}

export function EmptyState({ icon = "Circle", title, description, action, className }: EmptyStateProps) {
  const IconComponent = resolveIcon(icon)

  return (
    <div className={cn("flex flex-col items-center justify-center py-12 text-center", className)}>
      <IconComponent size={32} className="mb-3 text-hover" />
      <p className="text-sm text-text-secondary">{title}</p>
      <p className="text-xs mt-1 text-text-muted">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-3 py-1.5 rounded-md text-xs font-medium border border-border text-text-secondary transition-colors hover:opacity-80"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
