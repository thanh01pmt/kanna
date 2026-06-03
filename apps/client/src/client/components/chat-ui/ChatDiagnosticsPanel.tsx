import { useState } from "react"
import { Activity, AlertTriangle, CheckCircle2, ChevronDown, ChevronRight, CircleDollarSign, Clock3, GitCommitHorizontal, PieChart, Route, X } from "lucide-react"
import type { TranscriptEntry, HydratedTranscriptMessage } from "@kanna/shared/types"
import { deriveChatDiagnostics, type ChatDiagnosticStep } from "../../lib/chatDiagnostics"
import { formatContextWindowTokens } from "../../lib/contextWindow"
import { cn } from "../../lib/utils"
import { Button } from "../ui/button"

interface ChatDiagnosticsPanelProps {
  messages: readonly (TranscriptEntry | HydratedTranscriptMessage)[]
  onClose: () => void
}

function formatDuration(ms: number) {
  if (!Number.isFinite(ms) || ms <= 0) return "0s"
  const seconds = Math.round(ms / 1000)
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSeconds = seconds % 60
  if (minutes < 60) return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`
  const hours = Math.floor(minutes / 60)
  const remainingMinutes = minutes % 60
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`
}

function formatCost(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "$0.000000"
  return `$${value.toFixed(6)}`
}

function formatTime(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ""
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
}

function percent(part: number, total: number) {
  if (!Number.isFinite(part) || !Number.isFinite(total) || total <= 0) return 0
  return Math.max(0, Math.min(100, (part / total) * 100))
}

function stepTone(step: ChatDiagnosticStep) {
  switch (step.kind) {
    case "user_input":
      return "border-cyan-500/20 bg-cyan-500/10 text-cyan-500"
    case "assistant_response":
      return "border-violet-500/20 bg-violet-500/10 text-violet-500"
    case "tool_call":
    case "tool_result":
      return step.isError
        ? "border-destructive/20 bg-destructive/10 text-destructive"
        : "border-emerald-500/20 bg-emerald-500/10 text-emerald-500"
    case "token_usage":
      return "border-logo/20 bg-logo/10 text-logo"
    case "result":
      return step.isError
        ? "border-destructive/20 bg-destructive/10 text-destructive"
        : "border-muted-foreground/20 bg-muted text-muted-foreground"
    default:
      return "border-border bg-muted text-muted-foreground"
  }
}

function formatStepKind(kind: ChatDiagnosticStep["kind"]) {
  return kind.replaceAll("_", " ")
}

export function ChatDiagnosticsPanel({ messages, onClose }: ChatDiagnosticsPanelProps) {
  const [expandedStepIds, setExpandedStepIds] = useState<Set<string>>(() => new Set())
  const diagnostics = deriveChatDiagnostics(messages)
  const tokenTotal = Math.max(
    diagnostics.tokens.inputKnown
      + diagnostics.tokens.outputKnown
      + diagnostics.tokens.reasoningOutputKnown
      + diagnostics.tokens.toolEstimated,
    diagnostics.tokens.totalKnown,
  )
  const inputPct = percent(diagnostics.tokens.inputKnown, tokenTotal)
  const outputPct = percent(diagnostics.tokens.outputKnown + diagnostics.tokens.reasoningOutputKnown, tokenTotal)
  const toolPct = percent(diagnostics.tokens.toolEstimated, tokenTotal)
  const inputStop = inputPct
  const outputStop = inputPct + outputPct
  const toolStop = inputPct + outputPct + toolPct
  const donutBackground = tokenTotal > 0
    ? `conic-gradient(var(--logo) 0deg ${inputStop * 3.6}deg, rgb(16 185 129) ${inputStop * 3.6}deg ${outputStop * 3.6}deg, rgb(168 85 247) ${outputStop * 3.6}deg ${toolStop * 3.6}deg, hsl(var(--muted)) ${toolStop * 3.6}deg 360deg)`
    : "hsl(var(--muted))"

  const toggleStep = (stepId: string) => {
    setExpandedStepIds((current) => {
      const next = new Set(current)
      if (next.has(stepId)) {
        next.delete(stepId)
      } else {
        next.add(stepId)
      }
      return next
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="flex h-12 shrink-0 items-center justify-between border-b border-border/70 px-4">
        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
          <Activity className="h-4 w-4 text-muted-foreground" />
          Diagnostics
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose} title="Close diagnostics" aria-label="Close diagnostics">
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-md border border-border/70 bg-card/60 p-3">
            <div className="text-[11px] font-medium uppercase text-muted-foreground">Known tokens</div>
            <div className="mt-1 text-xl font-semibold text-foreground">{formatContextWindowTokens(diagnostics.tokens.totalKnown)}</div>
            <div className="mt-1 text-xs text-muted-foreground">{diagnostics.tokens.source.replaceAll("_", " ")}</div>
          </div>
          <div className="rounded-md border border-border/70 bg-card/60 p-3">
            <div className="text-[11px] font-medium uppercase text-muted-foreground">Steps</div>
            <div className="mt-1 text-xl font-semibold text-foreground">{diagnostics.steps.length}</div>
            <div className="mt-1 text-xs text-muted-foreground">{diagnostics.summary.toolCallCount} tool calls</div>
          </div>
          <div className="rounded-md border border-border/70 bg-card/60 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase text-muted-foreground">
              <Clock3 className="h-3 w-3" />
              Duration
            </div>
            <div className="mt-1 text-xl font-semibold text-foreground">{formatDuration(diagnostics.summary.totalDurationMs)}</div>
          </div>
          <div className="rounded-md border border-border/70 bg-card/60 p-3">
            <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase text-muted-foreground">
              <CircleDollarSign className="h-3 w-3" />
              Cost
            </div>
            <div className="mt-1 text-xl font-semibold text-foreground">{formatCost(diagnostics.summary.totalCostUsd)}</div>
          </div>
        </div>

        <section className="mt-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <PieChart className="h-4 w-4" />
            Token analytics
          </div>
          <div className="rounded-md border border-border/70 bg-card/45 p-4">
            <div className="flex items-center gap-5">
              <div className="relative flex h-28 w-28 shrink-0 items-center justify-center rounded-full" style={{ background: donutBackground }}>
                <div className="flex h-[68px] w-[68px] flex-col items-center justify-center rounded-full bg-background">
                  <span className="text-[10px] font-semibold uppercase text-muted-foreground">Total</span>
                  <span className="text-lg font-semibold text-foreground">{formatContextWindowTokens(tokenTotal)}</span>
                </div>
              </div>
              <div className="min-w-0 flex-1 space-y-2 text-sm">
                <TokenLegend colorClass="bg-logo" label="Input" value={diagnostics.tokens.inputKnown} pct={inputPct} />
                <TokenLegend colorClass="bg-emerald-500" label="Output" value={diagnostics.tokens.outputKnown + diagnostics.tokens.reasoningOutputKnown} pct={outputPct} />
                <TokenLegend colorClass="bg-violet-500" label="Tool est." value={diagnostics.tokens.toolEstimated} pct={toolPct} />
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <GitCommitHorizontal className="h-4 w-4" />
            Top resource steps
          </div>
          <div className="space-y-2">
            {diagnostics.topResourceSteps.length > 0 ? diagnostics.topResourceSteps.map((step) => (
              <div key={step.id} className="rounded-md border border-border/70 bg-card/45 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">#{step.index}</span>
                    <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase", stepTone(step))}>
                      {formatStepKind(step.kind)}
                    </span>
                  </div>
                  <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
                    {formatContextWindowTokens(step.tokenEstimate ?? 0)}
                  </span>
                </div>
                <div className="mt-2 truncate text-sm text-foreground">{step.label}</div>
                {step.preview ? <div className="mt-1 line-clamp-2 text-xs text-muted-foreground">{step.preview}</div> : null}
              </div>
            )) : (
              <div className="rounded-md border border-border/70 bg-card/45 p-4 text-sm text-muted-foreground">
                No token-bearing steps yet.
              </div>
            )}
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
              <Route className="h-4 w-4" />
              Agent trajectory
            </div>
            <span className="text-xs text-muted-foreground">{diagnostics.steps.length} steps</span>
          </div>
          <div className="space-y-2">
            {diagnostics.steps.length > 0 ? diagnostics.steps.map((step) => {
              const isExpanded = expandedStepIds.has(step.id)
              const canExpand = Boolean(step.detail && step.detail !== step.preview)
              return (
                <div key={step.id} className="rounded-md border border-border/70 bg-card/45">
                  <button
                    type="button"
                    className="flex w-full items-start gap-2 px-3 py-3 text-left"
                    onClick={() => canExpand && toggleStep(step.id)}
                    disabled={!canExpand}
                  >
                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-muted-foreground">
                      {canExpand ? (
                        isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
                      ) : (
                        <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-3">
                        <div className="flex min-w-0 items-center gap-2">
                          <span className="text-xs font-semibold text-muted-foreground">#{step.index}</span>
                          <span className={cn("rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase", stepTone(step))}>
                            {formatStepKind(step.kind)}
                          </span>
                        </div>
                        <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
                          {step.tokenEstimate ? <span>{formatContextWindowTokens(step.tokenEstimate)} tkn</span> : null}
                          <span>{formatTime(step.timestamp)}</span>
                        </div>
                      </div>
                      <div className="mt-2 truncate text-sm font-medium text-foreground">{step.label}</div>
                      {step.preview ? <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{step.preview}</div> : null}
                    </div>
                  </button>
                  {isExpanded && step.detail ? (
                    <div className="border-t border-border/60 bg-background/55 px-3 py-3">
                      <pre className="max-h-64 overflow-auto whitespace-pre-wrap break-words rounded bg-muted/35 p-3 text-xs leading-5 text-muted-foreground">
                        {step.detail}
                      </pre>
                    </div>
                  ) : null}
                </div>
              )
            }) : (
              <div className="rounded-md border border-border/70 bg-card/45 p-4 text-sm text-muted-foreground">
                No trajectory data yet.
              </div>
            )}
          </div>
        </section>

        <section className="mt-5">
          <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
            <AlertTriangle className="h-4 w-4" />
            Optimization tips
          </div>
          <div className="space-y-2">
            {diagnostics.tips.map((tip) => {
              const Icon = tip.kind === "ok" ? CheckCircle2 : tip.kind === "warning" ? AlertTriangle : Activity
              return (
                <div key={`${tip.kind}:${tip.title}`} className="rounded-md border border-border/70 bg-card/45 p-3">
                  <div className="flex items-start gap-2">
                    <Icon className={cn(
                      "mt-0.5 h-4 w-4 shrink-0",
                      tip.kind === "ok" ? "text-emerald-500" : tip.kind === "warning" ? "text-amber-500" : "text-muted-foreground",
                    )} />
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-foreground">{tip.title}</div>
                      <div className="mt-1 text-xs leading-5 text-muted-foreground">{tip.detail}</div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

function TokenLegend({ colorClass, label, value, pct }: { colorClass: string; label: string; value: number; pct: number }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className={cn("h-2.5 w-2.5 shrink-0 rounded-full", colorClass)} />
        <span className="truncate text-muted-foreground">{label}</span>
      </div>
      <span className="shrink-0 text-xs font-semibold tabular-nums text-foreground">
        {formatContextWindowTokens(value)} ({pct.toFixed(1)}%)
      </span>
    </div>
  )
}
