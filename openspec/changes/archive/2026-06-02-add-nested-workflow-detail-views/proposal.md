## Why

Nested workflows are useful, but showing the entire nested tree in one panel makes complex projects hard to read. Users need a main flow view for high-level progress and separate detail views for each nested workflow.

## What Changes

- Add a main workflow flow tab showing project-level workflow order and status.
- Add nested workflow detail tabs/views for selected workflow nodes.
- Allow users to click a workflow node in the main flow to inspect its internal sub-flow.
- Preserve artifact outputs and status summaries in both overview and detail contexts.
- Keep runtime/projection semantics unchanged; this is a UI/navigation and projection-shaping enhancement.

## Capabilities

### New Capabilities
- `nested-workflow-views`: Covers main flow overview, nested workflow detail tabs, navigation between workflow levels, and status/artifact summaries.

### Modified Capabilities
- `workflow-engine`: Existing nested nodes should be projected with enough identity/breadcrumb data for detail navigation.

## Impact

- Workflow tracker UI: tabs/views for overview and nested detail.
- Projection shape: stable node identifiers, parent/child breadcrumbs, summary counts.
- Design system: compact graph/list representation for main flow and detail flow.
