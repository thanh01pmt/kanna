import type { WorkflowArtifactRef, WorkflowDefinitionSummary, WorkflowNode } from "@kanna/shared/types"

export type {
  WorkflowArtifactImpact,
  WorkflowArtifactImpactStatus,
  WorkflowArtifactRef,
  WorkflowNode,
  WorkflowNodeSource,
  WorkflowNodeStatus,
  WorkflowNodeType,
  WorkflowRunProjection,
  WorkflowDefinitionSummary,
} from "@kanna/shared/types"

export interface WorkflowTrackerActions {
  onClose?: () => void
  onSelectNode?: (node: WorkflowNode) => void
  onRerunNode?: (node: WorkflowNode) => void
  onReviewDownstream?: (artifact: WorkflowArtifactRef) => void
  onRepairDownstream?: (sourceArtifact: WorkflowArtifactRef, impacted: WorkflowArtifactRef[]) => void
  onRegenerateArtifact?: (artifact: WorkflowArtifactRef) => void
  onInvalidateArtifact?: (artifact: WorkflowArtifactRef) => void
  onAcceptArtifact?: (artifact: WorkflowArtifactRef) => void
  onRerunArtifact?: (artifact: WorkflowArtifactRef) => void
  onViewArtifact?: (artifact: WorkflowArtifactRef) => void
  workflowDefinitions?: WorkflowDefinitionSummary[]
  onStartWorkflow?: (definition: WorkflowDefinitionSummary) => void | Promise<void>
  isStartingWorkflow?: boolean
  proposedManifest?: import("@kanna/shared/workflow-schema").WorkflowManifest
  onPublishWorkflow?: (manifest: import("@kanna/shared/workflow-schema").WorkflowManifest) => void | Promise<void>
  onRejectWorkflow?: () => void
}
