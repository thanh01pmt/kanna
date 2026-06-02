## Overview

Workflow readiness is derived from project artifact state. A registered workflow is ready only when its required inputs are present and accepted as source-of-truth. When inputs change after outputs exist, the affected workflow/output should enter review rather than blindly rerunning.

## Input Types

MVP supports:

- `file`: a concrete file path.
- `directory`: all files under a directory.
- `glob`: file pattern such as `units/U01/lessons/**/*.md`.

All matching artifacts must be evaluated through artifact state, not plain filesystem existence alone.

## Artifact States

Readiness accepts:

- `source_of_truth`
- `reviewed_ok`

New outputs should default to:

- `needs_review`

When an input changes:

- impacted outputs/workflows become `needs_review` or `maybe_stale`
- AI may evaluate the diff and recommend `not_impacted` or `needs_repair`
- user or permitted AI autonomy approves the final state

## Readiness Projection

For each registered workflow:

- `ready`: all required inputs satisfied
- `blocked`: required inputs missing or not source-of-truth
- `running`: workflow currently has an active run
- `needs_review`: inputs changed or downstream review is required
- `can_repair`: impacted artifacts are known and repair is available

## Version and Checksum

For each workflow output, store enough metadata to compare the artifact version/checksum used to create it with the current input artifact versions/checksums. If an input version is newer than the output's recorded input version, the output is stale until reviewed.

## Autonomy

Support these policy values:

- `manual_review`
- `ai_recommend_user_approve`
- `ai_auto_approve_low_risk`
- `ai_auto_approve_all`

MVP can persist policy as settings JSON and implement conservative behavior first.

## Non-Goals

- Full AI graph inference.
- Parallel worktree orchestration.
- Full resume scheduler.
