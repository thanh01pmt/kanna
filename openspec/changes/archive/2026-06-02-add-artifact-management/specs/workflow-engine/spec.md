## ADDED Requirements

### Requirement: Artifact Action Controls
The Workflow Tracker Panel SHALL provide fine-grained controls for individual artifacts in expanded view modes, enabling users to `Rerun`, `Review downstream`, `Repair downstream`, `Regenerate`, `Invalidate`, or `Accept as source of truth` without re-running the entire workflow.

#### Scenario: Interacting with an Artifact
- **WHEN** the user views an artifact in expanded density mode
- **THEN** the UI SHALL display the available action buttons styled as pill-shaped (`rounded-full`) or tag-shaped (`rounded-md`) elements.

### Requirement: Downstream Impact Resolution
The system SHALL dynamically compute a dependency tree based on `artifact_impacts` to determine downstream artifacts that require attention when a source artifact is modified or selected for repair.

#### Scenario: Bulk Repair Initiation
- **WHEN** the user triggers the "Repair downstream" action on an artifact
- **THEN** the server SHALL recursively calculate all impacted artifacts.
- **AND** the UI SHALL present a confirmation dialog (`DialogOverlay` with `z-index 50`) listing the affected items before executing the repair operation.
