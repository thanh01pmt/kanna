## Why

MVP parallel execution uses the same workspace, so workflow runs need artifact locks and conflict detection before multiple workflows or agents modify the same files. Canonical artifacts should have one owner workflow, while shared append-only artifacts need explicit multi-writer rules.

## What Changes

- Add artifact ownership rules for canonical, derived, and shared/append-only artifacts.
- Add lock acquisition for workflow file, directory, and glob inputs/outputs.
- Detect conflicts when sibling workflows attempt to write the same canonical artifact.
- Allow review/repair requests when a non-owner workflow needs to change another workflow's canonical artifact.
- Support interrupted lock recovery and lock timeouts for same-workspace execution.

## Capabilities

### New Capabilities
- `workflow-locks-conflicts`: Covers artifact ownership, same-workspace locks, write conflict detection, shared artifact exceptions, and review/repair handoff.

### Modified Capabilities
- `workflow-readiness`: Readiness should consider locks and conflicts before offering a workflow as runnable.
- `workflow-engine`: Start/repair actions must acquire locks or report blockers before modifying artifacts.

## Impact

- Database/runtime: lock records or event-backed lock state.
- Artifact metadata: ownership class and owner workflow.
- Server commands: acquire/release lock, detect conflicts, recover interrupted locks.
- UI: blocked-by-lock/conflict states and repair request flow.
