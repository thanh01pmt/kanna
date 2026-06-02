## 1. Job and Worktree Model
- [x] 1.1 Add sub-agent job state and worktree metadata.
- [x] 1.2 Add worktree/branch creation and cleanup utilities.
- [x] 1.3 Link jobs to project workflow registrations and pinned versions.

## 2. Execution
- [x] 2.1 Add command/API to spawn a workflow in a parallel worktree.
- [x] 2.2 Route sub-agent execution into the isolated worktree.
- [x] 2.3 Record produced artifact candidates and diff summaries.

## 3. Merge Review
- [x] 3.1 Add merge preview with ownership/conflict/stale checks.
- [x] 3.2 Add merge, request repair, and discard actions.
- [x] 3.3 Mark merged artifacts as `needs_review` unless policy allows auto-approval.

## 4. UI
- [x] 4.1 Add parallel jobs section to Workflow panel.
- [x] 4.2 Show job status, worktree branch, diff summary, and produced artifacts.
- [x] 4.3 Add merge/discard/repair actions.

## 5. Verification
- [x] 5.1 Test worktree creation and cleanup.
- [x] 5.2 Test merge-time ownership and stale input checks.
- [x] 5.3 Test discarded jobs do not modify main workspace.
- [x] 5.4 Validate OpenSpec and run relevant tests.

