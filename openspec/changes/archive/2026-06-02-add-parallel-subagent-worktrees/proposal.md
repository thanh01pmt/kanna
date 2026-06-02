## Why

Same-workspace locks are the MVP safety model, but true parallel workflow execution needs isolated worktrees so sub-agents can work independently without overwriting each other's files. Worktree-based execution allows parallel branches, controlled merge review, and safer conflict resolution.

## What Changes

- Add worktree-backed execution for parallel sub-agent workflow runs.
- Create isolated worktrees/branches for sub-agent jobs.
- Track worktree ownership, status, produced artifacts, and diffs.
- Merge sub-agent results back through explicit review.
- Integrate artifact ownership and lock/conflict rules with worktree merge decisions.
- Surface parallel job status in the workflow panel.

## Capabilities

### New Capabilities
- `parallel-subagent-worktrees`: Covers isolated worktree creation, sub-agent job tracking, diff review, merge/discard, and parallel workflow status.

### Modified Capabilities
- `workflow-locks-conflicts`: Worktree execution can reduce same-workspace locks but still needs merge-time conflict checks.
- `workflow-resume-orchestration`: Interrupted sub-agent jobs need resumable/recoverable worktree state.
- `workflow-engine`: Runtime projections must expose parallel sub-agent job status.

## Impact

- Git/worktree integration: create, list, merge, discard, cleanup.
- Server runtime: sub-agent job records and worktree path metadata.
- UI: parallel jobs panel, diff review, merge/discard actions.
- Artifact model: produced artifacts from isolated worktrees need review before becoming source-of-truth.
