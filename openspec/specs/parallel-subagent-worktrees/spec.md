# parallel-subagent-worktrees Specification

## Purpose
TBD - created by archiving change add-parallel-subagent-worktrees. Update Purpose after archive.
## Requirements
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
*** Add File: /Users/tonypham/MEGA/WebApp/kanna/openspec/changes/add-parallel-subagent-worktrees/tasks.md

