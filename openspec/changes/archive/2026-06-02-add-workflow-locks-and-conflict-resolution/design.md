## Overview

Same-workspace execution needs guardrails so workflows do not overwrite each other's canonical files. Locks protect artifact paths/directories/globs while a workflow is running. Ownership rules determine whether a workflow may write a given artifact directly.

## Artifact Ownership Classes

- `canonical`: exactly one owner workflow may create or edit directly.
- `derived`: one owner workflow creates it, based on upstream artifacts.
- `shared_append_only`: multiple workflows may append/write under explicit rules.
- `external`: tracked input not owned by a workflow.

## Ownership Rules

- Each canonical artifact must have one owner workflow.
- Non-owner workflow changes to canonical artifacts must become review/repair requests.
- Multiple sibling workflows writing the same canonical artifact is a conflict.
- Shared append-only artifacts are exempt when declared as such.

## Lock Scope

Locks can target:

- file path
- directory
- glob pattern

MVP uses same workspace locks:

- acquire before start or repair
- release on completion
- mark stale/interrupted if the run is interrupted
- allow timeout/recovery with user confirmation

## Conflict Resolution

Conflict examples:

- Two parallel workflows attempt to write `CURRICULUM_FRAMEWORK.md`.
- A non-owner workflow attempts to modify an owner workflow's canonical artifact.
- A directory output overlaps another workflow's file output.

Resolution:

- block start if conflict is known before execution
- show conflict reason in UI
- allow user to request review/repair instead of direct write
- allow shared append-only artifacts if declared

## Non-Goals

- Worktree/branch based parallel execution is future work.
- Automated merge of conflicting edits is future work.
