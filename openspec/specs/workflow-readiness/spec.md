# workflow-readiness Specification

## Purpose
TBD - created by archiving change add-workflow-readiness-gating. Update Purpose after archive.
## Requirements
### Requirement: Source-of-Truth Input Gating
The system SHALL evaluate registered workflow readiness from project artifact state, requiring input artifacts to be accepted as `source_of_truth` or `reviewed_ok` before the workflow is ready.

#### Scenario: Required input is unreviewed
- **WHEN** a registered workflow requires an input artifact
- **AND** the matching file exists but the artifact is not `source_of_truth` or `reviewed_ok`
- **THEN** the workflow SHALL be marked blocked rather than ready.

#### Scenario: Required input is accepted
- **WHEN** all required input artifacts for a registered workflow are present and accepted as `source_of_truth` or `reviewed_ok`
- **THEN** the workflow SHALL be marked ready.

### Requirement: File, Directory, and Glob Inputs
The system SHALL support workflow input declarations for concrete files, directories, and glob patterns.

#### Scenario: Directory input
- **WHEN** a workflow declares a directory input
- **THEN** the system SHALL evaluate the artifacts under that directory as the workflow input set.

#### Scenario: Glob input
- **WHEN** a workflow declares a glob input
- **THEN** the system SHALL evaluate artifacts matching the glob pattern as the workflow input set.

### Requirement: Stale Output Detection
The system SHALL detect when workflow outputs may be stale because accepted input artifacts changed after the outputs were produced.

#### Scenario: Input changed after output
- **WHEN** an input artifact version or checksum is newer than the version recorded for a workflow output
- **THEN** the downstream output or workflow SHALL be marked `needs_review` or `maybe_stale`.

### Requirement: Readiness Grouping in Start Panel
The Start Workflow panel SHALL group project-registered workflows by readiness state.

#### Scenario: Viewing registered workflows
- **WHEN** the user opens the Start Workflow panel
- **THEN** the UI SHALL distinguish workflows that are ready, blocked, running, needs review, or repairable.

### Requirement: Review Autonomy Policy
The system SHALL support user-configurable review autonomy for source-of-truth and downstream impact decisions.

#### Scenario: Manual review policy
- **WHEN** the policy is `manual_review`
- **THEN** AI recommendations SHALL NOT mark artifacts as source-of-truth without user approval.

#### Scenario: AI auto-approve policy
- **WHEN** the policy permits AI auto-approval
- **THEN** AI may mark artifacts or impact decisions approved within the configured scope.
*** Add File: /Users/tonypham/MEGA/WebApp/kanna/openspec/changes/add-workflow-readiness-gating/tasks.md

