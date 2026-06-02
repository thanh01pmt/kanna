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
