# workflow-sharing-marketplace Specification

## Purpose
Define workflow sharing by ID, private isolation, governed global publishing, import lineage, and stable project pins for shared workflows.
## Requirements
### Requirement: Share Workflow by ID
The system SHALL allow workflow owners to create share identifiers that let another user import a specific workflow definition or version.

#### Scenario: Import shared workflow by ID
- **WHEN** a user enters a valid shared workflow ID
- **THEN** the system SHALL show the workflow metadata, owner, version, and manifest summary
- **AND** require confirmation before importing it into the user's catalog.

### Requirement: Private Workflow Isolation
The system SHALL keep private user workflows hidden from other users unless explicitly shared or published globally.

#### Scenario: Unshared private workflow
- **WHEN** user A owns a private workflow
- **THEN** user B SHALL NOT see or import it without a valid share identifier or global publishing.

### Requirement: Official Global Publishing
The system SHALL support a governed flow for publishing workflows as official global workflows.

#### Scenario: Approve official workflow
- **WHEN** a workflow publish request is approved by an authorized reviewer
- **THEN** the workflow version SHALL become visible in all users' catalogs as official global.

### Requirement: Import Lineage
The system SHALL preserve lineage when a workflow is imported from another user or marketplace entry.

#### Scenario: Imported copy records source
- **WHEN** a user imports a shared workflow
- **THEN** the imported workflow SHALL record source workflow ID, source version, source owner, and import timestamp.

### Requirement: Project Pins Remain Stable
The system SHALL keep project workflow registrations pinned when shared or marketplace workflows receive new versions.

#### Scenario: Shared workflow update
- **WHEN** a newer version of an imported/shared workflow becomes available
- **THEN** existing project registrations SHALL remain pinned until the user explicitly upgrades.
