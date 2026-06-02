## Why

Kanna already stores workflow runs, nodes, events, artifacts, and impacts, but interrupted work is only tracked passively. Users need explicit resume orchestration so a paused or interrupted workflow can safely continue from the last known state after re-evaluating file state, readiness, locks, and downstream impacts.

## What Changes

- Add explicit run lifecycle actions: `Resume`, `Restart`, and `Archive run`.
- Add checkpoint metadata for workflow nodes and workflow outputs.
- Re-evaluate artifact state, readiness, locks, and impacts before resume.
- Identify resumable, blocked, failed, interrupted, and stale nodes after reload.
- Support conservative resume semantics for agent/sub-agent interrupted jobs.
- Surface resume decisions in the workflow panel.

## Capabilities

### New Capabilities
- `workflow-resume-orchestration`: Covers workflow run lifecycle recovery, checkpoint evaluation, resume/restart/archive actions, and post-interruption safety checks.

### Modified Capabilities
- `workflow-engine`: Runtime projections must expose interrupted/resumable run state.
- `workflow-readiness`: Resume checks must reuse readiness and stale detection before continuing.
- `workflow-locks-conflicts`: Resume must handle interrupted locks before continuing.

## Impact

- Database/runtime: checkpoint metadata, run lifecycle status, resume audit events.
- Server commands/API: resume run, restart run, archive run, inspect resume plan.
- UI: resume panel/actions and blocked resume explanations.
- Agent orchestration: resume prompt/context built from checkpoint and event history.
