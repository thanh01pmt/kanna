## Why

After projects can register individual workflows, users will need a higher-level way to add related workflows as a coherent set and understand how those workflows connect. Workflow packs and flow graphs let a project express `A -> B -> C` relationships without hard-coding execution order into a single workflow.

## What Changes

- Add workflow packs that group related workflow definitions and recommended versions.
- Add project flow graph modeling for registered workflows.
- Support explicit graph edges declared by packs or users.
- Infer graph edges from artifact inputs and outputs.
- Allow AI to suggest graph edges, requiring user approval before they become canonical.
- Surface the main project flow as an ordered graph distinct from nested workflow details.

## Capabilities

### New Capabilities
- `workflow-pack-flow-graph`: Covers workflow packs, project-level flow graph edges, artifact IO inference, AI-suggested graph edges, and graph approval.

### Modified Capabilities
- `project-workflow-registry`: Project registrations can be created from packs and participate in project flow graph ordering.
- `workflow-readiness`: Readiness can use graph relationships to explain upstream blockers.

## Impact

- Database schema: workflow pack metadata and project flow edge storage.
- Manifest/schema: pack references, flow edge declarations, and edge provenance.
- UI: project workflow graph view and pack registration flow.
- Runtime: graph projection for registered workflows and readiness explanations.
