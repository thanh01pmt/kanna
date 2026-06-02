## ADDED Requirements

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
## 1. Sharing Model
- [ ] 1.1 Add share identifiers/tokens for workflow definitions or versions.
- [ ] 1.2 Add import lineage metadata for shared workflows.
- [ ] 1.3 Enforce private workflow isolation without a valid share ID.

## 2. Import by ID
- [ ] 2.1 Add command/API to resolve shared workflow metadata by ID.
- [ ] 2.2 Add command/API to import a shared workflow into the current user's catalog.
- [ ] 2.3 Preserve source owner/version metadata on imported copies.

## 3. Official/Marketplace Publishing
- [ ] 3.1 Add official/global publish request and approval state.
- [ ] 3.2 Add marketplace metadata fields for category, tags, author, compatibility, and summary.
- [ ] 3.3 Make approved official global workflows visible to all users.

## 4. UI
- [ ] 4.1 Add share workflow action in Settings catalog.
- [ ] 4.2 Add import-by-ID flow with manifest summary and confirmation.
- [ ] 4.3 Add official/global publishing review state for authorized users.
- [ ] 4.4 Show source lineage and update availability for imported workflows.

## 5. Verification
- [ ] 5.1 Test private workflows are hidden from other users.
- [ ] 5.2 Test import by valid share ID and reject invalid/revoked IDs.
- [ ] 5.3 Test official approval makes workflow globally visible.
- [ ] 5.4 Validate OpenSpec and run relevant tests.
