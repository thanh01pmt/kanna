# workflow-resume-orchestration Specification

## Purpose
Define checkpoint-based resume planning, lifecycle actions, safety re-evaluation, and UI expectations for interrupted workflow runs.
## Requirements
### Requirement: Resume Plan Computation
The system SHALL compute a resume plan for interrupted workflow runs before allowing execution to continue.

#### Scenario: Inspect interrupted run
- **WHEN** a workflow run is interrupted
- **THEN** the system SHALL identify the last completed node, active interrupted node, stale artifacts, held locks, and recommended next action.

### Requirement: Resume, Restart, and Archive Actions
The system SHALL provide explicit lifecycle actions for interrupted workflow runs.

#### Scenario: Resume interrupted run
- **WHEN** the user chooses Resume
- **THEN** the system SHALL continue from the current checkpoint only after readiness, impact, and lock checks pass.

#### Scenario: Restart interrupted run
- **WHEN** the user chooses Restart
- **THEN** the system SHALL create a new workflow run from the currently pinned project workflow version.

#### Scenario: Archive interrupted run
- **WHEN** the user chooses Archive run
- **THEN** the system SHALL hide the run from active workflow surfaces without deleting its audit history.

### Requirement: Checkpoint Metadata
The system SHALL record enough checkpoint metadata to determine whether a workflow node can safely resume.

#### Scenario: Record node checkpoint
- **WHEN** a workflow node completes or pauses
- **THEN** the system SHALL record node identity, input artifact versions/checksums, output artifact versions/checksums, and last event sequence.

### Requirement: Resume Safety Re-evaluation
The system SHALL re-evaluate readiness, stale artifacts, impact review, and locks before resuming a workflow run.

#### Scenario: Input changed while interrupted
- **WHEN** an input artifact changed after the checkpoint
- **THEN** the system SHALL block direct resume and route the workflow through downstream impact review.

### Requirement: Resume UI
The workflow panel SHALL show interrupted runs with clear Resume, Restart, and Archive actions plus reasons when resume is blocked.

#### Scenario: Display blocked resume reason
- **WHEN** resume is blocked by stale inputs or locks
- **THEN** the UI SHALL show the blocking reason before any action is taken.
