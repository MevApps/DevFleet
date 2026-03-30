import type { GoalId } from "../../entities/ids"
import type { ArtifactKind } from "../../entities/Artifact"

export interface PhaseArtifact {
  readonly phase: string
  readonly kind: ArtifactKind
  readonly content: string
}

export interface ArtifactChain {
  gather(goalId: GoalId): Promise<readonly PhaseArtifact[]>
}
