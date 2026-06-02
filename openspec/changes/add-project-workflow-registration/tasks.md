## 1. Schema and Store
- [x] 1.1 Add `project_workflows` storage with pinned workflow version references.
- [x] 1.2 Add store methods for listing, registering, unregistering, enabling/disabling, and updating project workflows.
- [x] 1.3 Enforce at most one default entrypoint per project.

## 2. Protocol and Server
- [x] 2.1 Add WebSocket commands for project workflow registry operations.
- [x] 2.2 Update workflow definition listing for project UI to use registered workflows.
- [x] 2.3 Update `startRun` to validate project registration and use the pinned workflow version.

## 3. UI
- [x] 3.1 Add Project Workflows selection UI for ticking catalog workflows into a project.
- [x] 3.2 Add default entrypoint selection.
- [x] 3.3 Update Start Workflow panel to show only registered/enabled project workflows.
- [x] 3.4 Show upgrade available state when catalog latest version differs from pinned version.

## 4. Verification
- [x] 4.1 Add store tests for registration, default entrypoint, and pinned version behavior.
- [x] 4.2 Add UI tests for new project empty state and registered workflow Start panel.
- [x] 4.3 Validate OpenSpec and run relevant type/tests.
