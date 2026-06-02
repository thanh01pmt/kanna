import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleDashed,
  Clock3,
  Eye,
  FileText,
  GitBranch,
  History,
  Layers3,
  PanelRightClose,
  RefreshCw,
  SearchCheck,
  Sparkles,
  Wrench,
  XCircle,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"
import type { WorkflowArtifactImpact, WorkflowArtifactImpactStatus, WorkflowArtifactRef, WorkflowDefinitionSummary, WorkflowNode, WorkflowNodeStatus, WorkflowTrackerActions, WorkflowRunProjection } from "../types"
import { cn } from "../logic/cn"
import { WorkflowManifestReviewCard } from "./WorkflowManifestReviewCard"
import { countKnownWorkflowNodes, countLocalChildren, findChangedArtifact, findLiveNode, formatDuration, formatTokens, getImpactsForArtifact } from "../logic/projection"
import { calculateDownstreamImpacts } from "../logic/impacts"

export interface WorkflowTrackerPanelProps extends WorkflowTrackerActions {
  run: WorkflowRunProjection | null
  className?: string
  densityMode?: "compact" | "normal" | "expanded"
  onDensityModeChange?: (mode: "compact" | "normal" | "expanded") => void
}

const STATUS_LABEL: Record<WorkflowNodeStatus, string> = {
  horizon: "horizon",
  known: "known",
  running: "running",
  done: "done",
  failed: "failed",
  waiting: "waiting",
  skipped: "skipped",
}

const IMPACT_LABEL: Record<WorkflowArtifactImpactStatus, string> = {
  needs_review: "needs review",
  reviewed_ok: "reviewed ok",
  needs_repair: "needs repair",
  repaired: "repaired",
  not_impacted: "not impacted",
  maybe_impacted: "maybe impacted",
}

function StatusGlyph({ status }: { status: WorkflowNodeStatus }) {
  if (status === "done") return <Check className="h-3.5 w-3.5 text-[hsl(var(--chart-2))]" />
  if (status === "running") return <CircleDashed className="h-3.5 w-3.5 animate-spin text-[hsl(var(--chart-1))]" />
  if (status === "failed") return <XCircle className="h-3.5 w-3.5 text-logo" />
  if (status === "waiting") return <Clock3 className="h-3.5 w-3.5 text-muted-foreground" />
  if (status === "skipped") return <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
  return <span className="h-2 w-2 rounded-full border border-border bg-muted" />
}

function statusBadgeClass(status: WorkflowNodeStatus) {
  if (status === "running") return "border-[hsl(var(--chart-1)/0.35)] bg-[hsl(var(--chart-1)/0.12)] text-foreground"
  if (status === "done") return "border-[hsl(var(--chart-2)/0.35)] bg-[hsl(var(--chart-2)/0.12)] text-foreground"
  if (status === "failed") return "border-logo/30 bg-logo/10 text-foreground"
  return "border-border bg-muted/50 text-muted-foreground"
}

function NodeMeta({ node, densityMode = "normal" }: { node: WorkflowNode; densityMode?: "compact" | "normal" | "expanded" }) {
  const childCounts = countLocalChildren(node)
  const showLocalCount = (node.children?.length ?? 0) > 0
  const isCompact = densityMode === "compact"
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono">{node.nodeType}</span>
      <span className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono">{node.source}</span>
      {node.agent ? <span className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono">{node.agent}</span> : null}
      {node.durationMs && !isCompact ? <span className="font-mono">{formatDuration(node.durationMs)}</span> : null}
      {node.tokens && !isCompact ? <span className="font-mono">{formatTokens(node.tokens)}</span> : null}
      {showLocalCount ? (
        <span className="flex flex-wrap items-center gap-1.5 font-mono">
          {childCounts.done > 0 ? <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5">{childCounts.done} done</span> : null}
          {childCounts.running > 0 ? <span className="rounded-md border border-[hsl(var(--chart-1)/0.35)] bg-[hsl(var(--chart-1)/0.12)] text-foreground px-1.5 py-0.5">{childCounts.running} running</span> : null}
          {(childCounts.known - childCounts.done - childCounts.running) > 0 ? <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5">{childCounts.known - childCounts.done - childCounts.running} known next</span> : null}
          {!childCounts.sealed ? <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5">horizon open</span> : null}
        </span>
      ) : null}
    </div>
  )
}

function ArtifactChip({ 
  artifact,
  densityMode = "normal",
  actions,
}: { 
  artifact: WorkflowArtifactRef
  densityMode?: "compact" | "normal" | "expanded"
  actions?: WorkflowTrackerActions
}) {
  const isExpanded = densityMode === "expanded"
  
  return (
    <span className={cn(
      "group relative flex w-full min-w-0 items-center gap-1 rounded-lg border border-border bg-background px-2.5 py-1.5 text-[11px] text-muted-foreground transition-all hover:bg-muted/30",
      artifact.changed && "border-[hsl(var(--chart-1)/0.45)] bg-[hsl(var(--chart-1)/0.1)] text-foreground"
    )}>
      <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground/75" />
      <span className="truncate font-mono flex-1 text-left">{artifact.path}</span>
      <div className={cn(
        "flex shrink-0 items-center gap-1 overflow-hidden transition-all duration-200",
        isExpanded ? "ml-1 max-w-[400px] opacity-100" : "max-w-0 opacity-0 group-hover:ml-1 group-hover:max-w-[400px] group-hover:opacity-100"
      )}>
        <button type="button" className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] hover:bg-muted hover:text-foreground" onClick={(e) => { e.stopPropagation(); actions?.onViewArtifact?.(artifact) }}>View</button>
        <button type="button" className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] hover:bg-muted hover:text-foreground" onClick={(e) => { e.stopPropagation(); actions?.onRerunArtifact?.(artifact) }}>Rerun</button>
        <button type="button" className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] hover:bg-muted hover:text-foreground" onClick={(e) => { e.stopPropagation(); actions?.onReviewDownstream?.(artifact) }}>Review</button>
        <button type="button" className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] hover:bg-muted hover:text-foreground" onClick={(e) => { e.stopPropagation(); actions?.onRepairDownstream?.(artifact, []) }}>Repair</button>
        <button type="button" className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] hover:bg-muted hover:text-foreground" onClick={(e) => { e.stopPropagation(); actions?.onRegenerateArtifact?.(artifact) }}>Regen</button>
        <button type="button" className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] hover:bg-muted hover:text-foreground" onClick={(e) => { e.stopPropagation(); actions?.onInvalidateArtifact?.(artifact) }}>Invalidate</button>
        <button type="button" className="rounded-md border border-border bg-muted/40 px-1.5 py-0.5 text-[10px] hover:bg-muted hover:text-foreground" onClick={(e) => { e.stopPropagation(); actions?.onAcceptArtifact?.(artifact) }}>Accept</button>
      </div>
    </span>
  )
}

function artifactStatusLabel(artifact: WorkflowArtifactRef) {
  if (artifact.workflowStatus === "source_of_truth") return "source"
  if (artifact.workflowStatus === "invalidated") return "dirty"
  if (artifact.workflowStatus === "needs_repair") return "repair"
  if (artifact.workflowStatus === "needs_review") return "review"
  if (artifact.workflowStatus === "pending" || artifact.workflowStatus === "expected") return "pending"
  if (artifact.changed) return "dirty"
  return "done"
}

function artifactStatusClass(artifact: WorkflowArtifactRef) {
  const status = artifactStatusLabel(artifact)
  if (status === "done" || status === "source") return "border-[hsl(var(--chart-2)/0.35)] bg-[hsl(var(--chart-2)/0.12)] text-foreground"
  if (status === "dirty" || status === "repair" || status === "review") return "border-[hsl(var(--chart-1)/0.35)] bg-[hsl(var(--chart-1)/0.12)] text-foreground"
  return "border-border bg-muted/50 text-muted-foreground"
}

function ArtifactStatusGlyph({ artifact }: { artifact: WorkflowArtifactRef }) {
  const status = artifactStatusLabel(artifact)
  if (status === "done" || status === "source") return <Check className="h-3.5 w-3.5 text-[hsl(var(--chart-2))]" />
  if (status === "dirty" || status === "repair" || status === "review") return <AlertTriangle className="h-3.5 w-3.5 text-[hsl(var(--chart-1))]" />
  return <CircleDashed className="h-3.5 w-3.5 text-muted-foreground" />
}

function WorkflowArtifactsTable({
  artifacts,
  densityMode = "normal",
  actions,
  onRepairArtifact,
}: {
  artifacts: WorkflowArtifactRef[]
  densityMode?: "compact" | "normal" | "expanded"
  actions: WorkflowTrackerActions
  onRepairArtifact: (artifact: WorkflowArtifactRef) => void
}) {
  if (artifacts.length === 0) {
    return <div className="rounded-2xl border border-border bg-card p-3 text-sm text-muted-foreground">No workflow artifacts have been declared or observed yet.</div>
  }

  const isCompact = densityMode === "compact"
  const sorted = [...artifacts].sort((left, right) => {
    const leftExpected = left.expected ? 0 : 1
    const rightExpected = right.expected ? 0 : 1
    if (leftExpected !== rightExpected) return leftExpected - rightExpected
    return left.path.localeCompare(right.path)
  })

  return (
    <div className="overflow-hidden rounded-2xl border border-border bg-card">
      <div className="grid grid-cols-[82px_minmax(0,1fr)_86px_228px] gap-2 border-b border-border bg-muted/25 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        <span>Status</span>
        <span>Artifact</span>
        <span>Kind</span>
        <span className="text-right">Actions</span>
      </div>
      {sorted.map((artifact) => (
        <div key={artifact.id} className="grid grid-cols-[82px_minmax(0,1fr)_86px_228px] items-center gap-2 border-b border-border/70 px-3 py-2 last:border-b-0">
          <div className="flex items-center gap-1.5">
            <ArtifactStatusGlyph artifact={artifact} />
            <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-mono", artifactStatusClass(artifact))}>{artifactStatusLabel(artifact)}</span>
          </div>
          <div className="min-w-0">
            <div className="truncate font-mono text-xs text-foreground">{artifact.path}</div>
            {!isCompact && artifact.producedByNodeId ? <div className="mt-0.5 truncate text-[10px] text-muted-foreground">by {artifact.producedByNodeId}</div> : null}
          </div>
          <span className="truncate rounded-md border border-border bg-background px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground">{artifact.kind}</span>
          <div className="flex justify-end gap-1">
            <button type="button" title="View artifact" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => actions.onViewArtifact?.(artifact)}><Eye className="h-3.5 w-3.5" /></button>
            <button type="button" title="Rerun artifact" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => actions.onRerunArtifact?.(artifact)}><RefreshCw className="h-3.5 w-3.5" /></button>
            <button type="button" title="Review downstream" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => actions.onReviewDownstream?.(artifact)}><SearchCheck className="h-3.5 w-3.5" /></button>
            <button type="button" title="Repair downstream" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => onRepairArtifact(artifact)}><Wrench className="h-3.5 w-3.5" /></button>
            <button type="button" title="Regenerate artifact" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => actions.onRegenerateArtifact?.(artifact)}><Sparkles className="h-3.5 w-3.5" /></button>
            <button type="button" title="Invalidate artifact" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => actions.onInvalidateArtifact?.(artifact)}><XCircle className="h-3.5 w-3.5" /></button>
            <button type="button" title="Accept as source of truth" className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground" onClick={() => actions.onAcceptArtifact?.(artifact)}><Check className="h-3.5 w-3.5" /></button>
          </div>
        </div>
      ))}
    </div>
  )
}

function WorkflowNodeRow({
  node,
  depth,
  selectedNodeId,
  densityMode = "normal",
  actions,
  onSelectNode,
  onRerunNode,
}: {
  node: WorkflowNode
  depth: number
  selectedNodeId: string | null
  densityMode?: "compact" | "normal" | "expanded"
  actions?: WorkflowTrackerActions
  onSelectNode?: (node: WorkflowNode) => void
  onRerunNode?: (node: WorkflowNode) => void
}) {
  const startsOpen = densityMode === "expanded" || node.status === "running" || node.children?.some((child) => child.status === "running")
  const [open, setOpen] = useState(startsOpen)
  const hasChildren = Boolean(node.children?.length)
  const isSelected = selectedNodeId === node.id
  const canRerun = node.status === "done" || node.status === "failed" || node.status === "skipped"
  const isCompact = densityMode === "compact"

  return (
    <div>
      <button
        type="button"
        className={cn(
          "group flex w-full items-start gap-2 border-b border-border/70 px-3 py-2 text-left transition-colors hover:bg-muted/45",
          isSelected && "bg-muted/70",
          node.status === "horizon" && "opacity-70"
        )}
        style={{ paddingLeft: `${12 + depth * 16}px` }}
        onClick={() => {
          onSelectNode?.(node)
          if (hasChildren) setOpen((value) => !value)
        }}
      >
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center text-muted-foreground">
          {hasChildren ? <ChevronRight className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-90")} /> : <StatusGlyph status={node.status} />}
        </span>
        {hasChildren ? <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center"><StatusGlyph status={node.status} /></span> : null}
        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium text-foreground">{node.name}</span>
            <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em] font-mono", statusBadgeClass(node.status))}>
              {STATUS_LABEL[node.status]}
            </span>
          </span>
          <NodeMeta node={node} densityMode={densityMode} />
          {node.condition && !isCompact ? <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground font-mono">if: {node.condition}</div> : null}
          {node.logSummary && !isCompact ? <div className="mt-1 line-clamp-2 text-xs text-muted-foreground font-mono">{node.logSummary}</div> : null}
          {node.artifacts?.length && !isCompact ? <div className="mt-2 flex flex-col gap-1.5">{node.artifacts.map((artifact) => <ArtifactChip key={artifact.id} artifact={artifact} densityMode={densityMode} actions={actions} />)}</div> : null}
        </span>
        {canRerun ? (
          <span
            role="button"
            tabIndex={0}
            className="mt-0.5 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-foreground group-hover:opacity-100"
            title="Rerun node"
            onClick={(event) => {
              event.stopPropagation()
              onRerunNode?.(node)
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return
              event.preventDefault()
              event.stopPropagation()
              onRerunNode?.(node)
            }}
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </button>
      {hasChildren && open ? (
        <div>
          {node.children?.map((child) => (
            <WorkflowNodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedNodeId={selectedNodeId}
              densityMode={densityMode}
              actions={actions}
              onSelectNode={onSelectNode}
              onRerunNode={onRerunNode}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function ImpactRow({ impact, onRepairImpacted }: { impact: WorkflowArtifactImpact; onRepairImpacted?: (impact: WorkflowArtifactImpact) => void }) {
  const needsRepair = impact.status === "needs_repair" || impact.status === "maybe_impacted" || impact.status === "needs_review"
  return (
    <div className="rounded-xl border border-border bg-background/85 p-3">
      <div className="flex items-start gap-2">
        <AlertTriangle className={cn("mt-0.5 h-4 w-4 shrink-0", impact.status === "reviewed_ok" ? "text-[hsl(var(--chart-2))]" : "text-[hsl(var(--chart-1))]")} />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium text-foreground">{impact.impactedPath}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono">{IMPACT_LABEL[impact.status]}</span>
            <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono">{impact.relationship}</span>
            <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono">{impact.impactedKind}</span>
          </div>
          {impact.reason ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{impact.reason}</p> : null}
        </div>
        {needsRepair ? (
          <button
            type="button"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            title="Repair impacted artifact"
            onClick={() => onRepairImpacted?.(impact)}
          >
            <Wrench className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>
    </div>
  )
}

function EmptyWorkflowPanel({ onClose }: { onClose?: () => void }) {
  return (
    <aside className="flex h-full min-h-0 flex-col border-l border-border bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border px-3">
        <div className="flex items-center gap-2 text-sm font-medium text-foreground"><Layers3 className="h-4 w-4 text-logo" /> Workflow</div>
        {onClose ? <button type="button" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose}><PanelRightClose className="h-4 w-4" /></button> : null}
      </div>
      <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">No workflow run has materialized for this chat yet.</div>
    </aside>
  )
}

function WorkflowStartCard({
  definitions,
  onStartWorkflow,
  isStartingWorkflow,
  run,
  onRepairArtifact,
}: {
  definitions?: WorkflowDefinitionSummary[]
  onStartWorkflow?: (definition: WorkflowDefinitionSummary) => void | Promise<void>
  isStartingWorkflow?: boolean
  run?: WorkflowRunProjection | null
  onRepairArtifact?: (artifact: WorkflowArtifactRef) => void
}) {
  if (!definitions?.length || !onStartWorkflow) return null

  const groups = useMemo(() => {
    const registered = definitions.filter(d => d.isRegistered && d.isEnabled)
    const running: WorkflowDefinitionSummary[] = []
    const repairable: WorkflowDefinitionSummary[] = []
    const review: WorkflowDefinitionSummary[] = []
    const blocked: WorkflowDefinitionSummary[] = []
    const ready: WorkflowDefinitionSummary[] = []

    for (const def of registered) {
      if (def.readiness === "running") running.push(def)
      else if (def.readiness === "can_repair") repairable.push(def)
      else if (def.readiness === "needs_review") review.push(def)
      else if (def.readiness === "blocked") blocked.push(def)
      else ready.push(def)
    }

    return { running, repairable, review, blocked, ready }
  }, [definitions])

  const renderGroup = (
    title: string,
    items: WorkflowDefinitionSummary[],
    badgeClass: string,
    icon: React.ReactNode
  ) => {
    if (items.length === 0) return null

    return (
      <div className="space-y-2 mt-4 first:mt-0">
        <h4 className="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted-foreground flex items-center gap-1.5 px-1">
          {icon}
          {title} ({items.length})
        </h4>
        <div className="space-y-2">
          {items.map((definition) => {
            const repairableArt = run?.latestArtifacts?.find(art => art.workflowStatus === "needs_repair")

            return (
              <div key={definition.id} className="rounded-2xl border border-border bg-card p-3 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="truncate text-sm font-semibold text-foreground" title={definition.name}>{definition.name}</span>
                      <code className="text-[10px] px-1 rounded bg-muted text-muted-foreground font-mono">{definition.slug}</code>
                    </div>
                    {definition.description ? (
                      <p className="mt-1.5 text-xs text-muted-foreground line-clamp-2 leading-relaxed">{definition.description}</p>
                    ) : null}

                    {definition.readiness === "blocked" && definition.unsatisfiedInputs && (
                      <div className="mt-2.5 space-y-1">
                        <div className="text-[10px] font-medium text-red-500 uppercase tracking-wider">Unsatisfied Inputs:</div>
                        <div className="flex flex-wrap gap-1">
                          {definition.unsatisfiedInputs.map((input, idx) => (
                            <span
                              key={idx}
                              className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full border font-mono truncate max-w-[200px]",
                                input.status === "missing"
                                  ? "border-red-500/25 bg-red-500/10 text-red-500"
                                  : "border-amber-500/25 bg-amber-500/10 text-amber-500"
                              )}
                              title={`${input.path} (${input.status || "unreviewed"})`}
                            >
                              {input.status === "missing" ? "Missing" : "Unreviewed"}: {input.path.split("/").pop()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {definition.readiness === "needs_review" && definition.staleInputs && (
                      <div className="mt-2.5 space-y-1">
                        <div className="text-[10px] font-medium text-amber-500 uppercase tracking-wider">Stale / Updated Inputs:</div>
                        <div className="flex flex-wrap gap-1">
                          {definition.staleInputs.map((input, idx) => (
                            <span
                              key={idx}
                              className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/25 bg-amber-500/10 text-amber-500 font-mono truncate max-w-[200px]"
                              title={`${input.path} (Stale input)`}
                            >
                              Stale: {input.path.split("/").pop()}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {definition.readiness === "can_repair" && (
                      <div className="mt-2 text-[11px] text-indigo-500 flex items-center gap-1">
                        <Wrench className="h-3 w-3 shrink-0" />
                        Downstream changes require repair before run.
                      </div>
                    )}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5 self-start">
                    {definition.readiness === "can_repair" && repairableArt && onRepairArtifact && (
                      <button
                        type="button"
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-indigo-500/20 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 hover:text-indigo-600 transition-colors"
                        title="Repair affected artifacts"
                        onClick={() => onRepairArtifact(repairableArt)}
                      >
                        <Wrench className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      className={cn(
                        "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60",
                        definition.readiness === "blocked"
                          ? "border-border bg-muted/20 text-muted-foreground cursor-not-allowed"
                          : "border-border bg-background text-foreground hover:bg-muted"
                      )}
                      disabled={Boolean(isStartingWorkflow) || definition.readiness === "blocked"}
                      onClick={() => onStartWorkflow(definition)}
                      title={definition.readiness === "blocked" ? "Workflow is blocked by unsatisfied inputs" : "Start workflow"}
                    >
                      {isStartingWorkflow ? "Starting..." : "Start"}
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  const hasItems = Object.values(groups).some(arr => arr.length > 0)
  if (!hasItems) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        No registered & enabled workflows found for this project.
      </div>
    )
  }

  return (
    <section className="p-3 border-b border-border space-y-4">
      {renderGroup(
        "Running",
        groups.running,
        "text-sky-500",
        <CircleDashed className="h-3.5 w-3.5 text-sky-500 animate-spin" />
      )}
      {renderGroup(
        "Repairable",
        groups.repairable,
        "text-indigo-500",
        <Wrench className="h-3.5 w-3.5 text-indigo-500 animate-pulse" />
      )}
      {renderGroup(
        "Needs Review",
        groups.review,
        "text-amber-500",
        <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
      )}
      {renderGroup(
        "Blocked",
        groups.blocked,
        "text-red-500",
        <AlertCircle className="h-3.5 w-3.5 text-red-500" />
      )}
      {renderGroup(
        "Ready",
        groups.ready,
        "text-emerald-500",
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
      )}
    </section>
  )
}

export function WorkflowTrackerPanel({
  run,
  className,
  densityMode = "normal",
  onDensityModeChange,
  ...actions
}: WorkflowTrackerPanelProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [repairTarget, setRepairTarget] = useState<WorkflowArtifactRef | null>(null)
  const counts = useMemo(() => run ? countKnownWorkflowNodes(run.root) : null, [run])
  const liveNode = useMemo(() => run ? findLiveNode(run.root) : null, [run])
  const changedArtifact = useMemo(() => findChangedArtifact(run?.latestArtifacts), [run])
  const changedImpacts = useMemo(() => changedArtifact ? getImpactsForArtifact(changedArtifact.id, run?.impacts) : [], [changedArtifact, run?.impacts])

  if (!run || !counts) {
    return (
      <aside className={cn("flex h-full min-h-0 flex-col border-l border-border bg-background", className)}>
        <header className="shrink-0 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
                <Layers3 className="h-3.5 w-3.5 text-logo" /> Workflow Registry
              </div>
              <h2 className="mt-1 text-base font-semibold text-foreground">Project Workflows</h2>
            </div>
            {actions.onClose ? (
              <button type="button" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={actions.onClose} title="Close workflow sidebar">
                <PanelRightClose className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {actions.proposedManifest && actions.onPublishWorkflow ? (
            <div className="p-3 border-b border-border">
              <WorkflowManifestReviewCard
                manifest={actions.proposedManifest}
                onPublish={actions.onPublishWorkflow}
                onReject={actions.onRejectWorkflow}
              />
            </div>
          ) : null}

          <WorkflowStartCard
            definitions={actions.workflowDefinitions}
            onStartWorkflow={actions.onStartWorkflow}
            isStartingWorkflow={actions.isStartingWorkflow}
            run={null}
            onRepairArtifact={setRepairTarget}
          />
        </div>
      </aside>
    )
  }

  return (
    <aside className={cn("flex h-full min-h-0 flex-col border-l border-border bg-background", className)}>
      <header className="shrink-0 border-b border-border bg-background/95 px-3 py-3 backdrop-blur-md">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
              <Layers3 className="h-3.5 w-3.5 text-logo" /> Workflow
            </div>
            <h2 className="mt-1 truncate text-base font-semibold text-foreground">{run.title}</h2>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {onDensityModeChange ? (
              <div className="mr-2 inline-flex items-center rounded-lg border border-border p-[3px] bg-muted/30">
                <button
                  type="button"
                  className={cn("rounded-[4px] px-2 py-1 text-[11px] font-medium transition-colors", densityMode === "compact" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => onDensityModeChange("compact")}
                >
                  Compact
                </button>
                <button
                  type="button"
                  className={cn("rounded-[4px] px-2 py-1 text-[11px] font-medium transition-colors", densityMode === "normal" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => onDensityModeChange("normal")}
                >
                  Normal
                </button>
                <button
                  type="button"
                  className={cn("rounded-[4px] px-2 py-1 text-[11px] font-medium transition-colors", densityMode === "expanded" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}
                  onClick={() => onDensityModeChange("expanded")}
                >
                  Expanded
                </button>
              </div>
            ) : null}
            {actions.onClose ? (
              <button type="button" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={actions.onClose} title="Close workflow sidebar">
                <PanelRightClose className="h-4 w-4" />
              </button>
            ) : null}
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono">{formatDuration(run.elapsedMs)}</span>
          <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono">{formatTokens(run.tokenTotalKnown)}</span>
          <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono">{counts.done} done</span>
          {counts.running > 0 ? <span className="rounded-md border border-[hsl(var(--chart-1)/0.35)] bg-[hsl(var(--chart-1)/0.12)] text-foreground px-1.5 py-0.5 font-mono">{counts.running} running</span> : null}
          {(counts.known - counts.done - counts.running) > 0 ? <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono">{counts.known - counts.done - counts.running} known next</span> : null}
          {counts.openHorizon ? <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono">horizon open</span> : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {actions.proposedManifest && actions.onPublishWorkflow ? (
          <div className="p-3 border-b border-border">
            <WorkflowManifestReviewCard
              manifest={actions.proposedManifest}
              onPublish={actions.onPublishWorkflow}
              onReject={actions.onRejectWorkflow}
            />
          </div>
        ) : null}

        <WorkflowStartCard
          definitions={actions.workflowDefinitions}
          onStartWorkflow={actions.onStartWorkflow}
          isStartingWorkflow={actions.isStartingWorkflow}
          run={run}
          onRepairArtifact={setRepairTarget}
        />

        <section className="border-b border-border p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" /> Live
          </div>
          {liveNode ? (
            <div className="rounded-2xl border border-[hsl(var(--chart-1)/0.35)] bg-card p-3 shadow-sm">
              <div className="flex items-start gap-2">
                <StatusGlyph status={liveNode.status} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">{liveNode.name}</div>
                  <NodeMeta node={liveNode} />
                  {liveNode.logSummary ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{liveNode.logSummary}</p> : null}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card p-3 text-sm text-muted-foreground">No active step. Waiting for the next event.</div>
          )}
        </section>

        {changedArtifact ? (
          <section className="border-b border-border p-3">
            <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              <SearchCheck className="h-3.5 w-3.5" /> Impact Review
            </div>
            <div className="space-y-2">
              <div className="rounded-2xl border border-border bg-card p-3">
                <div className="text-sm font-medium text-foreground">{changedArtifact.path} changed</div>
                <div className="mt-1 text-xs text-muted-foreground">Use artifact lineage to review downstream instead of pretending the whole workflow total is known.</div>
                <button
                  type="button"
                  className="mt-3 inline-flex h-8 items-center rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted"
                  onClick={() => actions.onReviewDownstream?.(changedArtifact)}
                >
                  Review downstream
                </button>
              </div>
              {changedImpacts.map((impact) => <ImpactRow key={impact.id} impact={impact} />)}
            </div>
          </section>
        ) : null}

        <section className="border-b border-border p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <GitBranch className="h-3.5 w-3.5" /> Progress Tree
          </div>
          <div className="overflow-hidden rounded-2xl border border-border bg-card">
            {run.root.children?.map((node) => (
              <WorkflowNodeRow
                key={node.id}
                node={node}
                depth={0}
                selectedNodeId={selectedNodeId}
                densityMode={densityMode}
                actions={{
                  ...actions,
                  onRepairDownstream: (artifact) => setRepairTarget(artifact)
                }}
                onRerunNode={actions.onRerunNode}
                onSelectNode={(selected) => {
                  setSelectedNodeId(selected.id)
                  actions.onSelectNode?.(selected)
                }}
              />
            ))}
          </div>
        </section>

        <section className="p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Workflow Artifacts
          </div>
          <WorkflowArtifactsTable
            artifacts={run.latestArtifacts ?? []}
            densityMode={densityMode}
            actions={actions}
            onRepairArtifact={setRepairTarget}
          />
        </section>
      </div>
      
      {repairTarget ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl border border-border bg-background p-5 shadow-xl">
            <h3 className="text-lg font-semibold text-foreground">Confirm Downstream Repair</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              Repairing <span className="font-mono text-foreground">{repairTarget.path}</span> will also impact the following downstream artifacts:
            </p>
            <div className="my-4 max-h-60 overflow-y-auto rounded-lg border border-border bg-muted/30 p-2">
              {(() => {
                const impacted = calculateDownstreamImpacts(repairTarget.id, run.impacts ?? [], run.latestArtifacts ?? [])
                if (impacted.length === 0) return <div className="p-2 text-sm text-muted-foreground font-mono">No downstream artifacts found.</div>
                return (
                  <ul className="space-y-1">
                    {impacted.map(art => (
                      <li key={art.id} className="flex items-center gap-2 rounded px-2 py-1 text-[11px] hover:bg-muted/50 font-mono text-muted-foreground">
                        <AlertTriangle className="h-3 w-3 text-[hsl(var(--chart-1))]" />
                        {art.path}
                      </li>
                    ))}
                  </ul>
                )
              })()}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" className="rounded-md border border-border px-3 py-1.5 text-sm font-medium hover:bg-muted" onClick={() => setRepairTarget(null)}>Cancel</button>
              <button type="button" className="rounded-md bg-logo px-3 py-1.5 text-sm font-medium text-white hover:bg-logo/90" onClick={() => {
                const impacted = calculateDownstreamImpacts(repairTarget.id, run.impacts ?? [], run.latestArtifacts ?? [])
                actions.onRepairDownstream?.(repairTarget, impacted)
                setRepairTarget(null)
              }}>Confirm Repair</button>
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  )
}
