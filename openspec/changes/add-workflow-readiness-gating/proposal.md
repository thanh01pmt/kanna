## Why

After workflows are registered into a project, users need to know which workflows can run now and which are blocked by missing or unreviewed inputs. Readiness must be based on accepted source-of-truth artifacts rather than merely checking whether files exist.

## What Changes

- Add readiness evaluation for registered project workflows.
- Treat required input files/directories/globs as satisfied only when matching artifacts are `reviewed_ok` or `source_of_truth`.
- Compare input artifact versions/checksums against outputs to mark stale/downstream review states.
- Update Start panel to show ready, blocked, running, and needs-review workflow states.
- Preserve user/AI autonomy settings for whether AI can recommend or auto-approve source-of-truth decisions.

## Capabilities

### New Capabilities
- `workflow-readiness`: Covers input satisfaction, source-of-truth gating, stale detection, and ready/blocked presentation for project workflows.

### Modified Capabilities
- `workflow-engine`: Workflow runs and artifact impact review must respect readiness state before starting or repairing workflows.

## Impact

- Runtime store: readiness projection for project workflow registrations.
- Artifact metadata: source-of-truth/reviewed status and version/checksum comparison.
- UI: Start Workflow panel grouped by readiness state.
- Future extension point: AI diff review can recommend `not_impacted` or `needs_repair`.
