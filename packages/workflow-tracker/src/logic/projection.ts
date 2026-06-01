import type { WorkflowArtifactImpact, WorkflowArtifactRef, WorkflowNode, WorkflowNodeStatus } from "../types"

export interface WorkflowKnownCounts {
  known: number
  done: number
  running: number
  failed: number
  waiting: number
  horizon: number
  openHorizon: boolean
}

const DONE_STATUSES = new Set<WorkflowNodeStatus>(["done", "skipped"])

export function flattenWorkflowNodes(root: WorkflowNode): WorkflowNode[] {
  return [root, ...(root.children ?? []).flatMap(flattenWorkflowNodes)]
}

export function countKnownWorkflowNodes(root: WorkflowNode): WorkflowKnownCounts {
  const nodes = flattenWorkflowNodes(root).filter((node) => node.id !== root.id)
  const knownNodes = nodes.filter((node) => node.status !== "horizon")
  return {
    known: knownNodes.length,
    done: knownNodes.filter((node) => DONE_STATUSES.has(node.status)).length,
    running: knownNodes.filter((node) => node.status === "running").length,
    failed: knownNodes.filter((node) => node.status === "failed").length,
    waiting: knownNodes.filter((node) => node.status === "waiting").length,
    horizon: nodes.filter((node) => node.status === "horizon").length,
    openHorizon: nodes.some((node) => node.status === "horizon" || node.childrenSealed === false),
  }
}

export function countLocalChildren(node: WorkflowNode) {
  const children = node.children ?? []
  const known = children.filter((child) => child.status !== "horizon")
  return {
    known: known.length,
    done: known.filter((child) => DONE_STATUSES.has(child.status)).length,
    running: known.filter((child) => child.status === "running").length,
    horizon: children.length - known.length,
    sealed: node.childrenSealed === true,
  }
}

export function findLiveNode(root: WorkflowNode): WorkflowNode | null {
  const nodes = flattenWorkflowNodes(root)
  return nodes.find((node) => node.status === "running") ?? null
}

export function findChangedArtifact(artifacts: WorkflowArtifactRef[] = []) {
  return artifacts.find((artifact) => artifact.changed) ?? null
}

export function getImpactsForArtifact(artifactId: string, impacts: WorkflowArtifactImpact[] = []) {
  return impacts.filter((impact) => impact.sourceArtifactId === artifactId)
}

export function formatDuration(ms?: number) {
  if (!ms || ms <= 0) return "--"
  const totalSeconds = Math.round(ms / 1000)
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  if (minutes <= 0) return `${seconds}s`
  return `${minutes}m ${seconds.toString().padStart(2, "0")}s`
}

export function formatTokens(tokens?: number) {
  if (!tokens || tokens <= 0) return "--"
  if (tokens >= 1000) return `${(tokens / 1000).toFixed(1)}k tok`
  return `${tokens} tok`
}
