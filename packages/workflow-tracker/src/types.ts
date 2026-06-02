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
  WorkflowLock,
  WorkflowLockConflict,
  WorkflowJobStatus,
  WorkflowSubAgentJob,
  WorkflowShareToken,
  WorkflowMarketplaceMetadata,
  WorkflowImportLineage,
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
  onRegisterPack?: (packId: string) => void | Promise<void>
  onAddFlowEdge?: (sourceId: string, targetId: string) => void | Promise<void>
  onRemoveFlowEdge?: (sourceId: string, targetId: string) => void | Promise<void>
  onApproveFlowEdge?: (edgeId: string) => void | Promise<void>
  onRejectFlowEdge?: (edgeId: string) => void | Promise<void>
  onRecoverLock?: (lockId: string) => void | Promise<void>
  onInspectResumePlan?: (runId: string) => Promise<any>
  onResumeRun?: (runId: string) => void | Promise<void>
  onRestartRun?: (runId: string) => void | Promise<void>
  onArchiveRun?: (runId: string) => void | Promise<void>
  onSpawnParallelJob?: (runId: string, workflowDefinitionId: string) => void | Promise<void>
  onMergeParallelJob?: (jobId: string) => void | Promise<void>
  onDiscardParallelJob?: (jobId: string) => void | Promise<void>
  onShareWorkflow?: (definitionId: string) => Promise<string>
  onImportWorkflowById?: (shareId: string) => Promise<WorkflowDefinitionSummary>
  onPublishGlobalRequest?: (definitionId: string, metadata: WorkflowMarketplaceMetadata) => Promise<void>
  onApproveGlobalPublish?: (definitionId: string) => Promise<void>
  onRejectGlobalPublish?: (definitionId: string) => Promise<void>
}
