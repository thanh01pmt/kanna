import type { WorkflowArtifactImpact, WorkflowArtifactRef, WorkflowDefinitionSummary, WorkflowNode } from "@kanna/shared/types"

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
  onRepairImpacted?: (impact: WorkflowArtifactImpact) => void
  workflowDefinitions?: WorkflowDefinitionSummary[]
  onStartWorkflow?: (definition: WorkflowDefinitionSummary) => void | Promise<void>
  isStartingWorkflow?: boolean
}
