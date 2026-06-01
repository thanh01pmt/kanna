import { useMemo, useState } from "react"
import {
  AlertTriangle,
  Check,
  ChevronRight,
  CircleDashed,
  Clock3,
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
} from "lucide-react"
import type { WorkflowArtifactImpact, WorkflowArtifactImpactStatus, WorkflowArtifactRef, WorkflowDefinitionSummary, WorkflowNode, WorkflowNodeStatus, WorkflowTrackerActions, WorkflowRunProjection } from "../types"
import { cn } from "../logic/cn"
import { countKnownWorkflowNodes, countLocalChildren, findChangedArtifact, findLiveNode, formatDuration, formatTokens, getImpactsForArtifact } from "../logic/projection"

export interface WorkflowTrackerPanelProps extends WorkflowTrackerActions {
  run: WorkflowRunProjection | null
  className?: string
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

function NodeMeta({ node }: { node: WorkflowNode }) {
  const childCounts = countLocalChildren(node)
  const showLocalCount = (node.children?.length ?? 0) > 0
  return (
    <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
      <span className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono">{node.nodeType}</span>
      <span className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono">{node.source}</span>
      {node.agent ? <span className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono">{node.agent}</span> : null}
      {node.durationMs ? <span className="font-mono">{formatDuration(node.durationMs)}</span> : null}
      {node.tokens ? <span className="font-mono">{formatTokens(node.tokens)}</span> : null}
      {showLocalCount ? (
        <span className="font-mono">
          {childCounts.done}/{childCounts.known} {childCounts.sealed ? "steps" : "known"}
        </span>
      ) : null}
      {!childCounts.sealed && showLocalCount ? <span className="font-mono">horizon open</span> : null}
    </div>
  )
}

function ArtifactChip({ artifact }: { artifact: WorkflowArtifactRef }) {
  return (
    <span className={cn(
      "inline-flex min-w-0 items-center gap-1 rounded-lg border border-border bg-background px-2 py-1 text-[11px] text-muted-foreground",
      artifact.changed && "border-[hsl(var(--chart-1)/0.45)] bg-[hsl(var(--chart-1)/0.1)] text-foreground"
    )}>
      <FileText className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate font-mono">{artifact.path}</span>
    </span>
  )
}

function WorkflowNodeRow({
  node,
  depth,
  selectedNodeId,
  onSelectNode,
  onRerunNode,
}: {
  node: WorkflowNode
  depth: number
  selectedNodeId: string | null
  onSelectNode?: (node: WorkflowNode) => void
  onRerunNode?: (node: WorkflowNode) => void
}) {
  const startsOpen = node.status === "running" || node.children?.some((child) => child.status === "running")
  const [open, setOpen] = useState(startsOpen)
  const hasChildren = Boolean(node.children?.length)
  const isSelected = selectedNodeId === node.id
  const canRerun = node.status === "done" || node.status === "failed" || node.status === "skipped"

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
            <span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.04em]", statusBadgeClass(node.status))}>
              {STATUS_LABEL[node.status]}
            </span>
          </span>
          <NodeMeta node={node} />
          {node.condition ? <div className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">if: {node.condition}</div> : null}
          {node.logSummary ? <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{node.logSummary}</div> : null}
          {node.artifacts?.length ? <div className="mt-2 flex flex-wrap gap-1.5">{node.artifacts.map((artifact) => <ArtifactChip key={artifact.id} artifact={artifact} />)}</div> : null}
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
}: {
  definitions?: WorkflowDefinitionSummary[]
  onStartWorkflow?: (definition: WorkflowDefinitionSummary) => void | Promise<void>
  isStartingWorkflow?: boolean
}) {
  if (!definitions?.length || !onStartWorkflow) return null

  return (
    <section className="border-b border-border p-3">
      <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
        <GitBranch className="h-3.5 w-3.5" /> Start Workflow
      </div>
      <div className="space-y-2">
        {definitions.map((definition) => (
          <div key={definition.id} className="rounded-2xl border border-border bg-card p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-medium text-foreground">{definition.name}</div>
                <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                  <span className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono">{definition.workflowType}</span>
                  {definition.currentVersion ? <span className="rounded-md border border-border bg-background px-1.5 py-0.5 font-mono">{definition.currentVersion}</span> : null}
                </div>
                {definition.description ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{definition.description}</p> : null}
              </div>
              <button
                type="button"
                className="inline-flex h-8 shrink-0 items-center rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted disabled:cursor-not-allowed disabled:opacity-60"
                disabled={Boolean(isStartingWorkflow)}
                onClick={() => onStartWorkflow(definition)}
              >
                {isStartingWorkflow ? "Starting..." : "Start"}
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

export function WorkflowTrackerPanel({
  run,
  className,
  onClose,
  onSelectNode,
  onRerunNode,
  onReviewDownstream,
  onRepairImpacted,
  workflowDefinitions,
  onStartWorkflow,
  isStartingWorkflow,
}: WorkflowTrackerPanelProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const counts = useMemo(() => run ? countKnownWorkflowNodes(run.root) : null, [run])
  const liveNode = useMemo(() => run ? findLiveNode(run.root) : null, [run])
  const changedArtifact = useMemo(() => findChangedArtifact(run?.latestArtifacts), [run])
  const changedImpacts = useMemo(() => changedArtifact ? getImpactsForArtifact(changedArtifact.id, run?.impacts) : [], [changedArtifact, run?.impacts])

  if (!run || !counts) return <EmptyWorkflowPanel onClose={onClose} />

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
          {onClose ? (
            <button type="button" className="rounded-full p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} title="Close workflow sidebar">
              <PanelRightClose className="h-4 w-4" />
            </button>
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
          <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono">{formatDuration(run.elapsedMs)}</span>
          <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono">{formatTokens(run.tokenTotalKnown)}</span>
          <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono">{counts.done} done</span>
          <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono">{counts.known} known</span>
          {counts.openHorizon ? <span className="rounded-md border border-border bg-muted/50 px-1.5 py-0.5 font-mono">horizon open</span> : null}
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <WorkflowStartCard definitions={workflowDefinitions} onStartWorkflow={onStartWorkflow} isStartingWorkflow={isStartingWorkflow} />

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
                  onClick={() => onReviewDownstream?.(changedArtifact)}
                >
                  Review downstream
                </button>
              </div>
              {changedImpacts.map((impact) => <ImpactRow key={impact.id} impact={impact} onRepairImpacted={onRepairImpacted} />)}
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
                onRerunNode={onRerunNode}
                onSelectNode={(selected) => {
                  setSelectedNodeId(selected.id)
                  onSelectNode?.(selected)
                }}
              />
            ))}
          </div>
        </section>

        <section className="p-3">
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">
            <History className="h-3.5 w-3.5" /> Latest Artifacts
          </div>
          <div className="flex flex-wrap gap-1.5">
            {run.latestArtifacts?.map((artifact) => <ArtifactChip key={artifact.id} artifact={artifact} />)}
          </div>
        </section>
      </div>
    </aside>
  )
}
