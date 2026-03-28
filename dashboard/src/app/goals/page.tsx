"use client"
import { useDashboardStore } from "@/lib/store"
import { useWorkspaceStore } from "@/lib/workspace-store"
import { usePolling } from "@/hooks/use-polling"
import { GoalCard } from "@/components/composites/goal-card"
import { CreateGoalForm } from "@/components/composites/create-goal-form"
import { WorkspaceRequiredNotice } from "@/components/composites/workspace-required-notice"
import { EmptyState } from "@/components/primitives/empty-state"

export default function GoalsPage() {
  const { goals } = useDashboardStore()
  const fetchPipeline = useDashboardStore((s) => s.fetchPipeline)
  const run = useWorkspaceStore((s) => s.run)
  usePolling(fetchPipeline)

  const isActive = run?.status === "active"
  const repoName = run?.config.repoUrl.split("/").pop() ?? ""

  return (
    <div className="space-y-6">
      {isActive ? (
        <CreateGoalForm workspaceRepoName={repoName} />
      ) : (
        <WorkspaceRequiredNotice />
      )}
      {goals.length === 0 ? (
        <EmptyState icon="Target" title="No goals yet" description="Create a goal above to get started" />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {goals.map((goal) => (<GoalCard key={goal.id} goal={goal} />))}
        </div>
      )}
    </div>
  )
}
