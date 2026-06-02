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
