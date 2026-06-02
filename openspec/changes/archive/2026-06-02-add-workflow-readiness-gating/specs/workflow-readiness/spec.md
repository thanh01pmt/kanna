## ADDED Requirements

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
## 1. Readiness Model
- [ ] 1.1 Extend workflow manifest input declarations for file, directory, and glob input types.
- [ ] 1.2 Add readiness evaluator for project-registered workflows.
- [ ] 1.3 Require accepted `source_of_truth` or `reviewed_ok` state for required inputs.

## 2. Stale Detection
- [ ] 2.1 Record input artifact version/checksum metadata for workflow outputs.
- [ ] 2.2 Detect when input versions/checksums are newer than recorded output inputs.
- [ ] 2.3 Mark affected workflows/outputs as `needs_review` or `maybe_stale`.

## 3. Autonomy Policy
- [ ] 3.1 Add settings representation for review autonomy levels.
- [ ] 3.2 Apply conservative manual-review behavior by default.
- [ ] 3.3 Allow higher-trust policies to auto-approve source-of-truth or impact decisions within configured scope.

## 4. UI
- [ ] 4.1 Group registered workflows in the Start panel by ready, blocked, running, needs review, and repairable states.
- [ ] 4.2 Show missing or unreviewed input reasons for blocked workflows.
- [ ] 4.3 Show stale/review reasons when inputs changed after outputs were produced.

## 5. Verification
- [ ] 5.1 Add tests for file, directory, and glob readiness evaluation.
- [ ] 5.2 Add tests for source-of-truth gating and stale detection.
- [ ] 5.3 Validate OpenSpec and run relevant type/tests.
