# Change: Downstream Repair & Artifact Management UI

## Why
Currently, the system lacks the ability to selectively manage, review, and repair generated artifacts. Users need fine-grained controls on individual artifacts (e.g. Rerun, Review downstream, Repair downstream) rather than re-running entire workflows, as mandated by ADR 02.

## What Changes
- Add artifact action buttons (`Rerun`, `Review downstream`, `Repair downstream`, `Regenerate`, `Invalidate`, `Accept as source of truth`) to the Artifact component in expanded mode.
- Style buttons using standard tokens (rounded-full, rounded-md) based on Kanna Design System.
- Implement server-side downstream impact calculation to determine `needs_repair` dependencies recursively based on `artifact_impacts`.
- Implement a `DialogOverlay` with `z-index 50` and `shadow-xl` to prompt the user with a warning/confirmation before triggering bulk downstream repair.

## Impact
- Specs: `workflow-engine`
- Code: `WorkflowTrackerPanel.tsx`, `ArtifactChip.tsx` (or related components), Server MCP/store logic for impact resolution.
