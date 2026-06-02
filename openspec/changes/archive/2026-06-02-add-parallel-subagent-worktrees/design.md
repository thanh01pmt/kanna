## Overview

Parallel sub-agent execution should not write directly into the main workspace. Each parallel job gets an isolated git worktree or branch. The main project state changes only after user or policy-approved merge review.

## Execution Model

1. User selects ready workflows to run in parallel.
2. Server creates worktree/branch per sub-agent job.
3. Sub-agent runs in that worktree.
4. Runtime records job status, events, and produced artifact candidates.
5. User reviews diff/artifacts.
6. User merges, requests repair, or discards the job.

## Job State

Sub-agent jobs may be:

- `queued`
- `running`
- `waiting_review`
- `merged`
- `discarded`
- `failed`
- `interrupted`

Each job tracks:

- project ID
- parent workflow run ID
- workflow registration/version
- worktree path
- branch name
- produced artifacts
- diff summary
- merge status

## Merge Review

Merge review must check:

- artifact ownership conflicts
- overlapping outputs
- stale inputs since job started
- main workspace changes since branch creation
- shared append-only exceptions

Outputs from worktrees should default to `needs_review` until accepted.

## Cleanup

The system should support cleanup for:

- merged worktrees
- discarded worktrees
- interrupted worktrees
- abandoned branches

## Non-Goals

- Fully automated conflict merge is future work.
- Marketplace/sharing is covered separately.
