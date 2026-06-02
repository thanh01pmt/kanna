## ADDED Requirements

### Requirement: Project Workflow Registration
The system SHALL allow users to register selected workflow versions from the workflow catalog into a project.

#### Scenario: Registering workflows into a project
- **WHEN** a user selects workflows from the catalog for a project
- **THEN** the system SHALL create project workflow registrations
- **AND** each registration SHALL pin a specific workflow version.

### Requirement: Project Default Entrypoint
Each project SHALL support one default entrypoint workflow selected from its registered workflows.

#### Scenario: Setting a default entrypoint
- **WHEN** a user marks a registered workflow as the project default entrypoint
- **THEN** the system SHALL unset any previous default entrypoint for that project
- **AND** mark the selected workflow registration as default.

### Requirement: Project-Scoped Start Panel
The Start Workflow panel SHALL show only workflows registered and enabled for the active project.

#### Scenario: New project without registered workflows
- **WHEN** a project has no registered workflows
- **THEN** the Start Workflow panel SHALL NOT show unrelated catalog workflows
- **AND** it SHALL prompt the user to register workflows for the project.

#### Scenario: Starting a registered workflow
- **WHEN** the user starts a registered workflow
- **THEN** the workflow run SHALL use the pinned workflow version from the project registration.

### Requirement: Manual Version Upgrade
Project workflow registrations SHALL remain pinned to their selected workflow versions until the user explicitly upgrades them or changes an upgrade setting.

#### Scenario: New catalog version available
- **WHEN** a newer workflow version exists in the catalog
- **THEN** the project workflow registration SHALL continue using the pinned version
- **AND** the UI SHALL indicate that an upgrade is available.
*** Add File: /Users/tonypham/MEGA/WebApp/kanna/openspec/changes/add-project-workflow-registration/tasks.md
## 1. Schema and Store
- [ ] 1.1 Add `project_workflows` storage with pinned workflow version references.
- [ ] 1.2 Add store methods for listing, registering, unregistering, enabling/disabling, and updating project workflows.
- [ ] 1.3 Enforce at most one default entrypoint per project.

## 2. Protocol and Server
- [ ] 2.1 Add WebSocket commands for project workflow registry operations.
- [ ] 2.2 Update workflow definition listing for project UI to use registered workflows.
- [ ] 2.3 Update `startRun` to validate project registration and use the pinned workflow version.

## 3. UI
- [ ] 3.1 Add Project Workflows selection UI for ticking catalog workflows into a project.
- [ ] 3.2 Add default entrypoint selection.
- [ ] 3.3 Update Start Workflow panel to show only registered/enabled project workflows.
- [ ] 3.4 Show upgrade available state when catalog latest version differs from pinned version.

## 4. Verification
- [ ] 4.1 Add store tests for registration, default entrypoint, and pinned version behavior.
- [ ] 4.2 Add UI tests for new project empty state and registered workflow Start panel.
- [ ] 4.3 Validate OpenSpec and run relevant type/tests.
