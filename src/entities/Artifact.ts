import { type ArtifactId, type TaskId, type AgentId } from "./ids"

// ---------------------------------------------------------------------------
// Per-kind metadata types
// ---------------------------------------------------------------------------
interface SpecMetadata {
  readonly requirementCount: number
  readonly hasSuccessCriteria: boolean
}

interface PlanMetadata {
  readonly stepCount: number
  readonly estimatedTokens: number
}

interface DesignMetadata {
  readonly componentCount: number
}

interface DiffMetadata {
  readonly filesChanged: number
  readonly linesAdded: number
  readonly linesRemoved: number
}

interface ReviewMetadata {
  readonly verdict: "approved" | "rejected"
  readonly issueCount: number
}

interface TestReportMetadata {
  readonly passed: number
  readonly failed: number
  readonly coverageDelta: number
}

interface MetricReportMetadata {
  readonly metricCount: number
  readonly periodStart: number
  readonly periodEnd: number
}

// ---------------------------------------------------------------------------
// Per-kind artifact shapes
// ---------------------------------------------------------------------------
interface BaseArtifact {
  readonly id: ArtifactId
  readonly format: string
  readonly taskId: TaskId
  readonly createdBy: AgentId
  readonly content: string
}

interface SpecArtifact extends BaseArtifact {
  readonly kind: "spec"
  readonly metadata: SpecMetadata
}

interface PlanArtifact extends BaseArtifact {
  readonly kind: "plan"
  readonly metadata: PlanMetadata
}

interface DesignArtifact extends BaseArtifact {
  readonly kind: "design"
  readonly metadata: DesignMetadata
}

interface DiffArtifact extends BaseArtifact {
  readonly kind: "diff"
  readonly metadata: DiffMetadata
}

interface ReviewArtifact extends BaseArtifact {
  readonly kind: "review"
  readonly metadata: ReviewMetadata
}

interface TestReportArtifact extends BaseArtifact {
  readonly kind: "test_report"
  readonly metadata: TestReportMetadata
}

interface MetricReportArtifact extends BaseArtifact {
  readonly kind: "metric_report"
  readonly metadata: MetricReportMetadata
}

// ---------------------------------------------------------------------------
// Union
// ---------------------------------------------------------------------------
export type Artifact =
  | SpecArtifact
  | PlanArtifact
  | DesignArtifact
  | DiffArtifact
  | ReviewArtifact
  | TestReportArtifact
  | MetricReportArtifact

export type ArtifactKind = Artifact["kind"]

// ---------------------------------------------------------------------------
// Generic factory — TypeScript narrows the return type based on `kind`
// ---------------------------------------------------------------------------
export type CreateArtifactParams<K extends ArtifactKind> = {
  id: ArtifactId
  kind: K
  format: string
  taskId: TaskId
  createdBy: AgentId
  content: string
  metadata: Extract<Artifact, { kind: K }>["metadata"]
}

export function createArtifact<K extends ArtifactKind>(
  params: CreateArtifactParams<K>,
): Extract<Artifact, { kind: K }> {
  return {
    id: params.id,
    kind: params.kind,
    format: params.format,
    taskId: params.taskId,
    createdBy: params.createdBy,
    content: params.content,
    metadata: params.metadata,
  } as Extract<Artifact, { kind: K }>
}
