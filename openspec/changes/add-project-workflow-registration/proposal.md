## Why

Projects currently see workflow definitions that are not explicitly selected for that project. We need a project workflow registry so users choose which catalog workflows belong to a project, pin the exact version, and set a default entrypoint.

## What Changes

- Add a `project_workflows` registry mapping projects to workflow definitions and pinned versions.
- Add UI for selecting multiple catalog workflows for a project.
- Require each project to have at most one default entrypoint workflow.
- Update Start Workflow panel to show only workflows registered for the active project.
- Surface update availability when the catalog has a newer version than the pinned project version.

## Capabilities

### New Capabilities
- `project-workflow-registry`: Covers registering catalog workflow versions into projects, default entrypoints, pinned versions, and project-scoped Start Workflow lists.

### Modified Capabilities
- `workflow-engine`: Start-run behavior should use project-registered workflow versions rather than arbitrary global definitions.

## Impact

- Database schema: new `project_workflows` table.
- Server commands/API: list/register/unregister/update project workflows, set default entrypoint.
- Client project UI/right sidebar: Start panel filters by project registration.
- Runtime store: `startRun` validates that the selected workflow version is registered in the project.
