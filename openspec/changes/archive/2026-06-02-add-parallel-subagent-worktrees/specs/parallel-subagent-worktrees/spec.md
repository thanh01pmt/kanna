## ADDED Requirements

### Requirement: Worktree-Isolated Parallel Jobs
The system SHALL run parallel sub-agent workflow jobs in isolated worktrees or branches rather than writing directly to the main workspace.

#### Scenario: Spawn parallel job
- **WHEN** the user starts a parallel sub-agent workflow
- **THEN** the system SHALL create an isolated worktree or branch for that job
- **AND** record the job's workflow registration, pinned version, and worktree path.

### Requirement: Parallel Job Tracking
The system SHALL track lifecycle status for each parallel sub-agent job.

#### Scenario: Job waiting for review
- **WHEN** a sub-agent finishes work in its worktree
- **THEN** the job SHALL be marked `waiting_review`
- **AND** the UI SHALL show produced artifacts and diff summary.

### Requirement: Merge Review
The system SHALL require explicit merge review before worktree outputs are applied to the main workspace.

#### Scenario: Merge clean sub-agent output
- **WHEN** the user approves a sub-agent job with no conflicts
- **THEN** the system SHALL merge the worktree changes into the main workspace
- **AND** mark produced artifacts as `needs_review` unless policy permits auto-approval.

### Requirement: Merge-Time Conflict Checks
The system SHALL check artifact ownership, overlapping outputs, stale inputs, and main workspace divergence before merging sub-agent work.

#### Scenario: Ownership conflict at merge
- **WHEN** a worktree modifies a canonical artifact owned by another workflow
- **THEN** the merge SHALL be blocked and routed to conflict resolution or repair review.

### Requirement: Worktree Cleanup
The system SHALL support cleanup for merged, discarded, interrupted, or abandoned sub-agent worktrees.

#### Scenario: Discard job
- **WHEN** the user discards a sub-agent job
- **THEN** the system SHALL mark the job discarded and make its worktree eligible for cleanup.
## 1. Job and Worktree Model
- [ ] 1.1 Add sub-agent job state and worktree metadata.
- [ ] 1.2 Add worktree/branch creation and cleanup utilities.
- [ ] 1.3 Link jobs to project workflow registrations and pinned versions.

## 2. Execution
- [ ] 2.1 Add command/API to spawn a workflow in a parallel worktree.
- [ ] 2.2 Route sub-agent execution into the isolated worktree.
- [ ] 2.3 Record produced artifact candidates and diff summaries.

## 3. Merge Review
- [ ] 3.1 Add merge preview with ownership/conflict/stale checks.
- [ ] 3.2 Add merge, request repair, and discard actions.
- [ ] 3.3 Mark merged artifacts as `needs_review` unless policy allows auto-approval.

## 4. UI
- [ ] 4.1 Add parallel jobs section to Workflow panel.
- [ ] 4.2 Show job status, worktree branch, diff summary, and produced artifacts.
- [ ] 4.3 Add merge/discard/repair actions.

## 5. Verification
- [ ] 5.1 Test worktree creation and cleanup.
- [ ] 5.2 Test merge-time ownership and stale input checks.
- [ ] 5.3 Test discarded jobs do not modify main workspace.
- [ ] 5.4 Validate OpenSpec and run relevant tests.
