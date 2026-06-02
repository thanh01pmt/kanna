# workflow-locks-conflicts Specification

## Purpose
Define artifact ownership, workflow output locks, conflict detection, shared-output exceptions, and recovery behavior for interrupted workflow locks.
## Requirements
### Requirement: Artifact Ownership Enforcement
The system SHALL enforce ownership rules for canonical artifacts so only the owner workflow may directly create or edit them.

#### Scenario: Non-owner attempts canonical edit
- **WHEN** a workflow attempts to edit a canonical artifact owned by another workflow
- **THEN** the system SHALL block the direct edit path
- **AND** present a review or repair request path instead.

### Requirement: Same-Workspace Artifact Locks
The system SHALL acquire locks for file, directory, or glob artifact scopes before workflow execution modifies those scopes in the same workspace.

#### Scenario: Acquiring output lock
- **WHEN** a workflow starts and declares output artifact scopes
- **THEN** the system SHALL acquire locks for those scopes before allowing writes.

### Requirement: Conflict Detection
The system SHALL detect conflicts when multiple workflows attempt to write the same canonical artifact or overlapping artifact scopes.

#### Scenario: Sibling workflows target same canonical artifact
- **WHEN** two sibling workflows both target the same canonical artifact
- **THEN** the system SHALL mark the situation as a conflict requiring resolution before parallel execution.

### Requirement: Shared Append-Only Exception
The system SHALL allow multiple workflows to write to shared append-only artifacts only when the artifact is explicitly declared as shared append-only.

#### Scenario: Shared progress artifact
- **WHEN** multiple workflows append to a declared shared progress artifact
- **THEN** the system SHALL allow the writes under shared artifact rules.

### Requirement: Interrupted Lock Recovery
The system SHALL support recovery for locks held by interrupted or abandoned workflow runs.

#### Scenario: Recover interrupted lock
- **WHEN** a workflow run is interrupted while holding a lock
- **THEN** the system SHALL show the lock as recoverable
- **AND** allow the user or permitted policy to release or resume it safely.
