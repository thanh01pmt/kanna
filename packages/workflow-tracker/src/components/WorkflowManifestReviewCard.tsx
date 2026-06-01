import { CheckCircle2, GitBranch, ShieldAlert, FileText, Check, X } from "lucide-react"
import { WorkflowManifest } from "@kanna/shared/workflow-schema"
import { cn } from "../logic/cn"

interface WorkflowManifestReviewCardProps {
  manifest: WorkflowManifest
  onPublish: (manifest: WorkflowManifest) => void | Promise<void>
  onReject?: () => void
  isPublishing?: boolean
  className?: string
}

export function WorkflowManifestReviewCard({
  manifest,
  onPublish,
  onReject,
  isPublishing,
  className,
}: WorkflowManifestReviewCardProps) {
  return (
    <div className={cn("overflow-hidden rounded-2xl border border-border bg-card shadow-sm", className)}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-border bg-muted/30 p-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground">Import Workflow Manifest</h3>
            <span className="rounded-md border border-[hsl(var(--chart-2)/0.3)] bg-[hsl(var(--chart-2)/0.1)] px-1.5 py-0.5 text-[10px] font-medium text-[hsl(var(--chart-2))] uppercase tracking-widest">
              Review
            </span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Please review the extracted workflow definitions before publishing to the database.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {onReject && (
            <button
              type="button"
              className="inline-flex h-8 items-center justify-center rounded-full border border-border bg-background px-3 text-xs font-medium text-foreground hover:bg-muted disabled:opacity-50"
              onClick={onReject}
              disabled={isPublishing}
            >
              <X className="mr-1.5 h-3.5 w-3.5" /> Reject
            </button>
          )}
          <button
            type="button"
            className="inline-flex h-8 items-center justify-center rounded-full bg-primary px-3 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
            onClick={() => onPublish(manifest)}
            disabled={isPublishing}
          >
            {isPublishing ? (
              <span className="flex items-center">
                <span className="mr-1.5 h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary-foreground border-r-transparent" />
                Publishing...
              </span>
            ) : (
              <span className="flex items-center">
                <Check className="mr-1.5 h-3.5 w-3.5" /> Publish
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-2 gap-4 border-b border-border p-4 md:grid-cols-4">
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Workflow Name</div>
          <div className="mt-1 font-mono text-sm font-medium text-foreground">{manifest.name}</div>
        </div>
        <div>
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Version</div>
          <div className="mt-1 font-mono text-sm font-medium text-foreground">{manifest.version}</div>
        </div>
        <div className="md:col-span-2">
          <div className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Description</div>
          <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
            {manifest.description || "No description provided."}
          </div>
        </div>
      </div>

      {/* Artifacts List */}
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.06em] text-foreground">
          <FileText className="h-3.5 w-3.5 text-muted-foreground" /> Extracted Artifacts ({manifest.artifacts.length})
        </div>
        <div className="space-y-3">
          {manifest.artifacts.map((artifact) => {
            const hasDependencies = artifact.dependencies && artifact.dependencies.length > 0
            
            return (
              <div key={artifact.id} className="rounded-xl border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-medium text-foreground">{artifact.name}</span>
                      <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        {artifact.id}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span className="font-mono text-[11px] bg-muted/50 px-1 rounded">{artifact.pattern}</span>
                    </div>
                    {artifact.description && (
                      <p className="mt-2 text-xs text-muted-foreground">{artifact.description}</p>
                    )}
                  </div>
                  
                  <div className="flex shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-2 py-1 text-[10px] font-medium text-muted-foreground">
                    {hasDependencies ? (
                      <><GitBranch className="h-3 w-3" /> {artifact.dependencies!.length} dep(s)</>
                    ) : (
                      <><CheckCircle2 className="h-3 w-3 text-[hsl(var(--chart-2))]" /> Root</>
                    )}
                  </div>
                </div>
                
                {hasDependencies && (
                  <div className="mt-3 rounded-lg border border-border bg-muted/20 p-2">
                    <div className="mb-1.5 text-[10px] font-semibold uppercase text-muted-foreground">Dependencies</div>
                    <div className="space-y-1.5">
                      {artifact.dependencies!.map((dep, idx) => (
                        <div key={idx} className="flex items-center gap-2 text-xs">
                          <GitBranch className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-foreground">{dep.sourcePattern}</span>
                          <span className="text-[10px] text-muted-foreground">({dep.relationship})</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
      
      {/* Footer warning */}
      <div className="border-t border-border bg-[hsl(var(--chart-4)/0.05)] p-3 text-xs text-[hsl(var(--chart-4))] flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0" />
        <p>Publishing this manifest will overwrite any previous immutable version with the same version string.</p>
      </div>
    </div>
  )
}
