## Why

Workflow definitions are user-scoped by default, but SaaS users will eventually need to share workflows by ID, import workflows from other users, and discover official/global workflows. A sharing and marketplace layer creates controlled distribution without making every private workflow globally visible.

## What Changes

- Add workflow sharing by ID for user-to-user imports.
- Add official/global publishing workflow governance.
- Add marketplace/discovery metadata for workflow definitions and packs.
- Support imported copies or linked references depending on sharing policy.
- Preserve version history and project pinned versions when workflows are shared or imported.
- Add review/approval flow before shared workflows become available to another user or globally.

## Capabilities

### New Capabilities
- `workflow-sharing-marketplace`: Covers workflow visibility, share-by-ID, import from shared workflow, official/global publishing, discovery metadata, and marketplace governance.

### Modified Capabilities
- `workflow-catalog`: Catalog visibility expands from private/official to shared/importable workflows.
- `project-workflow-registry`: Projects can register workflows imported from shared marketplace entries.
- `workflow-pack-flow-graph`: Workflow packs can be shared and discovered alongside individual workflows.

## Impact

- Database schema: share tokens/IDs, marketplace metadata, import lineage, approval status.
- Settings UI: share workflow, import by ID, official/global publish review.
- Permissions: user ownership, visibility, and allowed import actions.
- Audit: track who shared, imported, approved, or deprecated a workflow.
