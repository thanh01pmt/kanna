## ADDED Requirements

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
*** Add File: /Users/tonypham/MEGA/WebApp/kanna/openspec/changes/add-workflow-resume-orchestration/tasks.md
## 1. Resume State Model
- [ ] 1.1 Add run lifecycle metadata for interrupted, archived, and resumable states.
- [ ] 1.2 Add checkpoint metadata for node input/output versions and last event sequence.
- [ ] 1.3 Add resume audit events.

## 2. Resume Planning
- [ ] 2.1 Implement resume plan computation for interrupted runs.
- [ ] 2.2 Re-evaluate readiness, stale outputs, impact review, and locks before resume.
- [ ] 2.3 Block resume with clear reasons when safety checks fail.

## 3. Commands and Agent Context
- [ ] 3.1 Add commands/API for inspect resume plan, resume run, restart run, and archive run.
- [ ] 3.2 Build resume prompt/context from checkpoint and event history.
- [ ] 3.3 Preserve original run version on resume and use current pinned version on restart.

## 4. UI
- [ ] 4.1 Add interrupted run state in Workflow panel.
- [ ] 4.2 Add Resume, Restart, and Archive run actions.
- [ ] 4.3 Show blocked resume reasons and required review/lock recovery actions.

## 5. Verification
- [ ] 5.1 Test resume plan computation from run/node/event state.
- [ ] 5.2 Test input-changed blocks direct resume.
- [ ] 5.3 Test restart creates a new run from pinned version.
- [ ] 5.4 Validate OpenSpec and run relevant tests.
