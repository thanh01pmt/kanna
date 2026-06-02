## Overview

Resume orchestration turns stored workflow state into an actionable recovery plan. The system must not blindly continue after interruption. It should inspect current artifact state, run status, locks, and downstream impacts before allowing resume.

## Run Lifecycle

Workflow runs may be:

- `running`
- `waiting`
- `interrupted`
- `failed`
- `done`
- `archived`

MVP can encode new lifecycle details in run metadata or events before widening DB status constraints.

## Checkpoints

Checkpoint metadata should capture:

- node ID
- workflow definition/version ID
- input artifact versions/checksums
- output artifact versions/checksums
- lock state
- last event sequence
- agent/sub-agent turn identity when available

Checkpoints can be stored in node metadata, event payloads, or a dedicated table. The design should favor append-only event audit plus projection-friendly metadata.

## Resume Plan

Before resuming, compute a resume plan:

- last completed node
- active/interrupted node
- blocked nodes
- stale outputs
- changed inputs
- held/recoverable locks
- recommended next action

Actions:

- `resume`: continue from current checkpoint.
- `restart`: create a new run from the pinned workflow version.
- `archive`: hide/close the interrupted run without deleting audit history.

## Safety Rules

- If input artifacts changed since checkpoint, resume must route through impact review.
- If locks are still held, resume must recover or release them first.
- If output artifacts were edited manually, resume must ask for source-of-truth review.
- If the run version no longer matches project registration, resume should warn but keep using the run's original version unless user restarts.

## Non-Goals

- Worktree-based sub-agent execution is covered by `add-parallel-subagent-worktrees`.
- Full automated merge/reconciliation is future work.
