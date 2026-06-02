# project-workflow-registry Specification

## Purpose
TBD - created by archiving change add-project-workflow-registration. Update Purpose after archive.
## Requirements
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

